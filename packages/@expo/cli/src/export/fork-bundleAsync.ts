import { ExpoConfig, getConfigFilePaths, Platform, ProjectConfig } from '@expo/config';
import chalk from 'chalk';
import Metro, { AssetData, MixedOutput, Module, ReadOnlyGraph } from 'metro';
import { ConfigT } from 'metro-config';
import getMetroAssets from 'metro/src/DeltaBundler/Serializers/getAssets';
import IncrementalBundler from 'metro/src/IncrementalBundler';
import splitBundleOptions from 'metro/src/lib/splitBundleOptions';
import Server from 'metro/src/Server';
import path from 'path';
import { SerialAsset } from '@expo/metro-config/build/serializer/serializerAssets';

import { CSSAsset, getCssModulesFromBundler } from '../start/server/metro/getCssModulesFromBundler';
import { loadMetroConfigAsync } from '../start/server/metro/instantiateMetro';
import { getEntryWithServerRoot } from '../start/server/middleware/ManifestMiddleware';
import {
  ExpoMetroBundleOptions,
  getMetroDirectBundleOptions,
} from '../start/server/middleware/metroOptions';
import {
  buildHermesBundleAsync,
  isEnableHermesManaged,
  maybeThrowFromInconsistentEngineAsync,
} from './exportHermes';

import type { LoadOptions } from '@expo/metro-config';
import type { BundleOptions as MetroBundleOptions } from 'metro/src/shared/types';
export type MetroDevServerOptions = LoadOptions;

export type BundleOptions = {
  entryPoint: string;
  platform: 'android' | 'ios' | 'web';
  dev?: boolean;
  minify?: boolean;
  sourceMapUrl?: string;
  sourcemaps?: boolean;
};
export type BundleAssetWithFileHashes = Metro.AssetData & {
  fileHashes: string[]; // added by the hashAssets asset plugin
};
export type BundleOutput = {
  // code: string;
  // map: string;
  artifacts: SerialAsset[];
  hermesBytecodeBundle?: Uint8Array;
  hermesSourcemap?: string;
  css: CSSAsset[];
  assets: readonly BundleAssetWithFileHashes[];
};

let nextBuildID = 0;

async function assertEngineMismatchAsync(
  projectRoot: string,
  exp: Pick<ExpoConfig, 'ios' | 'android' | 'jsEngine'>,
  platform: Platform
) {
  const isHermesManaged = isEnableHermesManaged(exp, platform);

  const paths = getConfigFilePaths(projectRoot);
  const configFilePath = paths.dynamicConfigPath ?? paths.staticConfigPath ?? 'app.json';
  await maybeThrowFromInconsistentEngineAsync(
    projectRoot,
    configFilePath,
    platform,
    isHermesManaged
  );
}

export async function createBundlesAsync(
  projectRoot: string,
  projectConfig: ProjectConfig,
  bundleOptions: {
    clear?: boolean;
    maxWorkers?: number;
    platforms: Platform[];
    dev?: boolean;
    minify?: boolean;
    sourcemaps?: boolean;
    entryPoint?: string;
  }
): Promise<Partial<Record<Platform, BundleOutput>>> {
  if (!bundleOptions.platforms.length) {
    return {};
  }
  const { exp, pkg } = projectConfig;

  const bundles = await bundleProductionMetroClientAsync(
    projectRoot,
    exp,
    {
      // If not legacy, ignore the target option to prevent warnings from being thrown.
      resetCache: bundleOptions.clear,
      maxWorkers: bundleOptions.maxWorkers,
    },
    bundleOptions.platforms.map((platform: Platform) => ({
      platform,
      entryPoint:
        bundleOptions.entryPoint ?? getEntryWithServerRoot(projectRoot, { platform, pkg }),
      sourcemaps: bundleOptions.sourcemaps,
      minify: bundleOptions.minify,
      dev: bundleOptions.dev,
    }))
  );

  // { ios: bundle, android: bundle }
  return bundleOptions.platforms.reduce<Partial<Record<Platform, BundleOutput>>>(
    (prev, platform, index) => ({
      ...prev,
      [platform]: bundles[index],
    }),
    {}
  );
}

async function bundleProductionMetroClientAsync(
  projectRoot: string,
  expoConfig: ExpoConfig,
  metroOptions: MetroDevServerOptions,
  bundles: BundleOptions[]
): Promise<BundleOutput[]> {
  // Assert early so the user doesn't have to wait until bundling is complete to find out that
  // Hermes won't be available.
  await Promise.all(
    bundles.map(({ platform }) => assertEngineMismatchAsync(projectRoot, expoConfig, platform))
  );

  const { config, reporter } = await loadMetroConfigAsync(projectRoot, metroOptions, {
    exp: expoConfig,
    isExporting: true,
  });

  const metroServer = await Metro.runMetro(config, {
    watch: false,
  });

  const buildAsync = async (bundle: BundleOptions): Promise<BundleOutput> => {
    const buildID = `bundle_${nextBuildID++}_${bundle.platform}`;
    const isHermes = isEnableHermesManaged(expoConfig, bundle.platform);
    const bundleOptions: MetroBundleOptions = {
      ...Server.DEFAULT_BUNDLE_OPTIONS,
      sourceMapUrl: bundle.sourceMapUrl,
      ...getMetroDirectBundleOptions({
        mainModuleName: bundle.entryPoint,
        platform: bundle.platform,
        mode: bundle.dev ? 'development' : 'production',
        engine: isHermes ? 'hermes' : undefined,
        serializerIncludeMaps: bundle.sourcemaps,
        // Bundle splitting on web-only for now.
        serializerOutput: bundle.platform === 'web' ? 'static' : undefined,
      }),
      bundleType: 'bundle',
      inlineSourceMap: false,
      createModuleIdFactory: config.serializer.createModuleIdFactory,
      onProgress: (transformedFileCount: number, totalFileCount: number) => {
        reporter.update({
          buildID,
          type: 'bundle_transform_progressed',
          transformedFileCount,
          totalFileCount,
        });
      },
    };
    const bundleDetails = {
      ...bundleOptions,
      buildID,
    };
    reporter.update({
      buildID,
      type: 'bundle_build_started',
      bundleDetails,
    });
    try {
      const artifacts = await forkMetroBuildAsync(metroServer, bundleOptions);
      const [assets, css] = await Promise.all([
        getAssets(metroServer, bundleOptions),
        getCssModulesFromBundler(config, metroServer.getBundler(), bundleOptions),
      ]);

      reporter.update({
        buildID,
        type: 'bundle_build_done',
      });
      return { artifacts, assets: assets as readonly BundleAssetWithFileHashes[], css };
    } catch (error) {
      reporter.update({
        buildID,
        type: 'bundle_build_failed',
      });

      throw error;
    }
  };

  const maybeAddHermesBundleAsync = async (
    bundle: BundleOptions,
    bundleOutput: BundleOutput
  ): Promise<BundleOutput> => {
    const { platform } = bundle;
    const isHermesManaged = isEnableHermesManaged(expoConfig, platform);
    if (isHermesManaged) {
      const platformTag = chalk.bold(
        { ios: 'iOS', android: 'Android', web: 'Web' }[platform] || platform
      );

      reporter.terminal.log(`${platformTag} Building Hermes bytecode for the bundle`);

      // TODO: Generate hbc for each chunk
      const hermesBundleOutput = await buildHermesBundleAsync(projectRoot, {
        code: bundleOutput.artifacts[0].source,
        map: bundle.sourcemaps ? bundleOutput.artifacts[1].source : null,
        minify: bundle.minify ?? !bundle.dev,
      });

      // TODO: Emit serial assets for each chunk
      bundleOutput.hermesBytecodeBundle = hermesBundleOutput.hbc;
      bundleOutput.hermesSourcemap = hermesBundleOutput.sourcemap ?? undefined;
    }
    return bundleOutput;
  };

  try {
    const intermediateOutputs = await Promise.all(bundles.map((bundle) => buildAsync(bundle)));
    const bundleOutputs: BundleOutput[] = [];
    for (let i = 0; i < bundles.length; ++i) {
      // hermesc does not support parallel building even we spawn processes.
      // we should build them sequentially.
      bundleOutputs.push(await maybeAddHermesBundleAsync(bundles[i], intermediateOutputs[i]));
    }
    return bundleOutputs;
  } catch (error) {
    // New line so errors don't show up inline with the progress bar
    console.log('');
    throw error;
  } finally {
    metroServer.end();
  }
}

// Forked out of Metro because the `this._getServerRootDir()` doesn't match the development
// behavior.
export async function getAssets(
  metro: Metro.Server,
  options: MetroBundleOptions
): Promise<readonly AssetData[]> {
  const { entryFile, onProgress, resolverOptions, transformOptions } = splitBundleOptions(options);

  // @ts-expect-error: _bundler isn't exposed on the type.
  const dependencies = await metro._bundler.getDependencies(
    [entryFile],
    transformOptions,
    resolverOptions,
    { onProgress, shallow: false, lazy: false }
  );

  // @ts-expect-error
  const _config = metro._config as ConfigT;

  return await getMetroAssets(dependencies, {
    processModuleFilter: _config.serializer.processModuleFilter,
    assetPlugins: _config.transformer.assetPlugins,
    platform: transformOptions.platform!,
    projectRoot: _config.projectRoot, // this._getServerRootDir(),
    publicPath: _config.transformer.publicPath,
  });
}

import type { ResolverInputOptions } from 'metro/src/shared/types';
import type { TransformInputOptions } from 'metro/src/DeltaBundler/types';

function isMetroServerInstance(metro: Metro.Server): metro is Metro.Server & {
  _shouldAddModuleToIgnoreList: (module: Module<MixedOutput>) => boolean;
  _bundler: IncrementalBundler;
  _config: ConfigT;
  _createModuleId: (path: string) => number;
  _resolveRelativePath(
    filePath: string,
    {
      relativeTo,
      resolverOptions,
      transformOptions,
    }: {
      relativeTo: 'project' | 'server';
      resolverOptions: ResolverInputOptions;
      transformOptions: TransformInputOptions;
    }
  ): Promise<string>;
  _getEntryPointAbsolutePath(entryFile: string): string;
  _getSortedModules(graph: ReadOnlyGraph): Array<Module<MixedOutput>>;
} {
  return '_shouldAddModuleToIgnoreList' in metro;
}

async function forkMetroBuildAsync(
  metro: Metro.Server,
  options: ExpoMetroBundleOptions
): Promise<SerialAsset[]> {
  if (!isMetroServerInstance(metro)) {
    throw new Error('Expected Metro server instance to have private functions exposed.');
  }

  const {
    entryFile,
    graphOptions,
    onProgress,
    resolverOptions,
    serializerOptions,
    transformOptions,
  } = splitBundleOptions(options);

  const { prepend, graph } = await metro._bundler.buildGraph(
    entryFile,
    transformOptions,
    resolverOptions,
    {
      onProgress,
      shallow: graphOptions.shallow,
      // @ts-expect-error
      lazy: graphOptions.lazy,
    }
  );

  const entryPoint = metro._getEntryPointAbsolutePath(entryFile);

  const bundleOptions = {
    asyncRequireModulePath: await metro._resolveRelativePath(
      metro._config.transformer.asyncRequireModulePath,
      {
        relativeTo: 'project',
        resolverOptions,
        transformOptions,
      }
    ),
    processModuleFilter: metro._config.serializer.processModuleFilter,
    createModuleId: metro._createModuleId,
    getRunModuleStatement: metro._config.serializer.getRunModuleStatement,
    dev: transformOptions.dev,
    includeAsyncPaths: graphOptions.lazy,
    projectRoot: metro._config.projectRoot,
    modulesOnly: serializerOptions.modulesOnly,
    runBeforeMainModule: metro._config.serializer.getModulesRunBeforeMainModule(
      path.relative(metro._config.projectRoot, entryPoint)
    ),
    runModule: serializerOptions.runModule,
    sourceMapUrl: serializerOptions.sourceMapUrl,
    sourceUrl: serializerOptions.sourceUrl,
    inlineSourceMap: serializerOptions.inlineSourceMap,
    serverRoot: metro._config.server.unstable_serverRoot ?? metro._config.projectRoot,
    shouldAddToIgnoreList: (module: Module<MixedOutput>) =>
      metro._shouldAddModuleToIgnoreList(module),
    // Custom options we pass to the serializer to emulate the URL query parameters.
    serializerOptions: options.serializerOptions,
  };

  const bundle = await metro._config.serializer.customSerializer!(
    entryPoint,
    prepend,
    graph,
    bundleOptions
  );

  if (options.serializerOptions?.output === 'static') {
    if (typeof bundle === 'string') {
      return JSON.parse(bundle) as SerialAsset[];
    } else {
      assert(Array.isArray(bundle), 'Expected serializer to return an array of serial assets.');
      return bundle;
    }
  }

  assert(typeof bundle === 'string', 'Expected serializer to return a string.');

  let bundleCode = bundle;
  let bundleMap = null;

  if (!bundleMap) {
    bundleMap = sourceMapString([...prepend, ...metro._getSortedModules(graph)], {
      excludeSource: serializerOptions.excludeSource,
      processModuleFilter: metro._config.serializer.processModuleFilter,
      shouldAddToIgnoreList: bundleOptions.shouldAddToIgnoreList,
    });
  }

  // Hack to make the single bundle use the multi-bundle pipeline.
  // TODO: Only support multi-bundle output format in the future.
  return [
    {
      filename: 'index.js',
      originFilename: 'index.js',
      source: bundleCode,
      type: 'js',
      metadata: {},
    },
    {
      filename: 'index.js.map',
      originFilename: 'index.js.map',
      source: bundleMap,
      type: 'map',
      metadata: {},
    },
  ];
}

import sourceMapString from 'metro/src/DeltaBundler/Serializers/sourceMapString';

import assert from 'assert';

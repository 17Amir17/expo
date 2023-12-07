# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "package.json")))
version = package['version']



# We are using two different paths for react native because of the way how js_srcs_dir and output_dir options are used
# output_dir option usage was introduced in https://github.com/facebook/react-native/pull/36210
# React-rncore.podspec is the only podspec in the project that uses this option
# We should rethink this approach in T148704916

# Relative path to react native from iOS project root (e.g. <ios-project-root>/../node_modules/react-native)
react_native_dependency_path = ENV['REACT_NATIVE_PATH']
# Relative path to react native from current podspec
react_native_sources_path = '..'

header_search_paths = [
  "\"$(PODS_TARGET_SRCROOT)\"",
  "\"$(PODS_TARGET_SRCROOT)/ReactCommon\"",
]

if ENV["USE_FRAMEWORKS"]
  create_header_search_path_for_frameworks("ReactCommon", :additional_framework_paths => ["react/nativemodule/core"], :include_base_folder => false)
    .each { |search_path| header_search_paths << "\"#{search_path}\"" }
end

Pod::Spec.new do |s|
  s.name                   = "ABI50_0_0React-rncore"
  s.version                = version
  s.summary                = "Fabric for React Native."
  s.homepage               = "https://reactnative.dev/"
  s.license                = package["license"]
  s.author                 = "Meta Platforms, Inc. and its affiliates"
  s.platforms              = min_supported_versions
  s.source                 = { :path => "." }
  s.source_files           = "dummyFile.cpp"
  s.pod_target_xcconfig = { "USE_HEADERMAP" => "YES",
                            "HEADER_SEARCH_PATHS" => header_search_paths.join(' '),
                            "CLANG_CXX_LANGUAGE_STANDARD" => "c++20" }

end

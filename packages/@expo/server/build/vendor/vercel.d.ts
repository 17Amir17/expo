import { AppLoadContext, Headers as NodeHeaders, Response as NodeResponse } from '@remix-run/node';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { ExpoRequest } from '../environment';
/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export type GetLoadContextFunction = (req: VercelRequest, res: VercelResponse) => AppLoadContext;
export type RequestHandler = (req: VercelRequest, res: VercelResponse) => Promise<void>;
/**
 * Returns a request handler for Vercel's Node.js runtime that serves the
 * response using Expo.
 */
export declare function createRequestHandler({ build }: {
    build: string;
}): RequestHandler;
export declare function convertHeaders(requestHeaders: VercelRequest['headers']): NodeHeaders;
export declare function convertRequest(req: VercelRequest, res: VercelResponse): ExpoRequest;
export declare function respond(res: VercelResponse, nodeResponse: NodeResponse): Promise<void>;

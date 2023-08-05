"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respond = exports.convertHeaders = exports.convertRequest = void 0;
require("@expo/server/install");
const node_1 = require("@remix-run/node");
const environment_1 = require("../environment");
// Convert an http request to an expo request
function convertRequest(req, res, routeConfig) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // const url = new URL(`${req.protocol}://${req.get('host')}${req.url}`);
    // Abort action/loaders once we can no longer write a response
    const controller = new node_1.AbortController();
    res.on('close', () => controller.abort());
    const init = {
        method: req.method,
        headers: convertHeaders(req.headers),
        // Cast until reason/throwIfAborted added
        // https://github.com/mysticatea/abort-controller/issues/36
        signal: controller.signal,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = req;
    }
    return new environment_1.ExpoRequest(url.href, init, routeConfig);
}
exports.convertRequest = convertRequest;
function convertHeaders(requestHeaders) {
    const headers = new node_1.Headers();
    for (const [key, values] of Object.entries(requestHeaders)) {
        if (values) {
            if (Array.isArray(values)) {
                for (const value of values) {
                    headers.append(key, value);
                }
            }
            else {
                headers.set(key, values);
            }
        }
    }
    return headers;
}
exports.convertHeaders = convertHeaders;
async function respond(res, expoRes) {
    res.statusMessage = expoRes.statusText;
    res.statusCode = expoRes.status;
    for (const [key, values] of Object.entries(expoRes.headers.raw())) {
        for (const value of values) {
            res.setHeader(key, value);
        }
    }
    if (expoRes.body) {
        await (0, node_1.writeReadableStreamToWritable)(expoRes.body, res);
    }
    else {
        res.end();
    }
}
exports.respond = respond;

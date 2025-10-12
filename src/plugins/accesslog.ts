import fs from 'fs';

import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fp from "fastify-plugin";



/**
 * Fastify plugin for Apache-style per-request access logging.
 *
 * This plugin adds an `onResponse` hook to Fastify, logging every request
 * in a single line format similar to Apache's access logs. It supports
 * logging to the console, a file, or both. The log includes:
 *   - Client IP (optionally from X-Forwarded-For if behind a trusted proxy)
 *   - Timestamp
 *   - HTTP method and URL
 *   - Response status code
 *   - Response time in milliseconds
 *   - Referer and User-Agent headers
 *
 * @async
 * @function AccessLogPlugin
 *
 * @param {FastifyInstance} fastify - The Fastify server instance.
 * @param {FastifyPluginOptions} opts - Optional plugin configuration.
 * @param {string|null} [opts.filePath=null] - Path to a file to append logs. Null disables file logging.
 * @param {boolean} [opts.consoleOutput=true] - Whether to print logs to the console.
 * @param {boolean} [opts.trustProxy=true] - Whether to trust X-Forwarded-For headers to get real client IP.
 *
 * @returns {void} Resolves once the logging hook is registered.
 *
 * @example
 * import AccessLogPlugin from './fastify-accesslog';
 *
 * fastify.register(AccessLogPlugin, {
 *   filePath: './access.log',
 *   consoleOutput: true,
 *   trustProxy: true
 * });
 *
 * fastify.get('/', async (req, res) => {
 *   return { hello: 'world' };
 * });
 */
export default fp((fastify: FastifyInstance, opts: FastifyPluginOptions) => {
    const {
        filePath = null,
        consoleOutput = true,
        trustProxy = true,
    } = opts;

    const stream: fs.WriteStream | null = filePath ? fs.createWriteStream(filePath, { flags: 'a' }) : null;

    function safeHeader(h: string | string[] | undefined) {
        if (!h) return '-';
        if (Array.isArray(h)) h = h.join(',');
        return String(h).replace(/["\r\n]/g, "'").trim();
    }

    fastify.addHook('onResponse', (req: FastifyRequest, res: FastifyReply, done) => {
        let ip = req.ip;
        if (trustProxy) {
            const xff = req.headers['x-forwarded-for'];
            if (xff) ip = String(xff).split(',')[0]!.trim();
        }
        const method = req.method;
        const url = req.url;
        const status = res.statusCode;
        const timeMs = res.elapsedTime ?? 0;
        const referer = safeHeader(req.headers['referer'] ?? req.headers['referrer']);
        const userAgent = safeHeader(req.headers['user-agent']);
        const timestamp = new Date().toISOString();
        const line = `${ip} - - [${timestamp}] "${method} ${url}" ${status} ${timeMs.toFixed(2)}ms "${referer}" "${userAgent}"\n`;

        if (consoleOutput) process.stdout.write(line);
        if (stream) stream.write(line);

        done();
    });
});
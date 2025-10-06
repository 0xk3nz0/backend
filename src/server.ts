import Fastify, {
    type FastifyError,
    type FastifyInstance,
    type FastifyPluginAsync,
    type FastifyPluginCallback,
    type FastifyPluginOptions,
    type FastifyRegisterOptions,
    type FastifyReply,
    type FastifyRequest
} from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

import type { ApplicationHook, LifecycleHook } from "fastify/types/hooks.js";

import jwt from '@fastify/jwt';
import fcors from '@fastify/cors';
import fcookie from '@fastify/cookie';
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import oauth2, { type FastifyOAuth2Options } from '@fastify/oauth2';

import addErrors from "ajv-errors";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import type Ajv from 'ajv';

import { chatSchema } from 'schemas/chat.js';

import { prisma as PrismaClientInstance } from './utils/prisma.js';
import LoggingOpts from './utils/logger.js';



export const fastify: FastifyInstance = Fastify({ logger: LoggingOpts });

export const wsValidators: Record<string, Ajv.ValidateFunction> = {};

type FastifyHookName = ApplicationHook | LifecycleHook;

export type ServerSecrets = {
    jwt: string,
    cookie: string
};

export type ServerRoute = {
    pcb: FastifyPluginCallback;
    opt: FastifyPluginOptions;
}

/**
 * Server
 *
 * Main application server class for bootstrapping and running the Fastify instance.
 * Handles plugin registration, route setup, hooks, error handling, and Prisma connection.
 *
 * Responsibilities:
 * - Configure and instantiate Fastify with logging and plugins.
 * - Register application routes and global hooks.
 * - Set up JWT, cookies, multipart, and rate limiting.
 * - Manage Prisma database connection lifecycle.
 * - Provide custom error and not-found handlers.
 * - Start and gracefully shut down the HTTP server.
 *
 * Usage:
 *   const app = new Server(host, port, rateLimitOpts, routes, hooks, secrets, plugins);
 *   await app.run();
 */
export default class Server {

    fastify: FastifyInstance;
    host: string;
    port: number;
    oauth_clients: FastifyOAuth2Options[];
    rateLimitOpts: FastifyRegisterOptions<any>;
    routes: ServerRoute[];
    hooks: Partial<Record<FastifyHookName, any>>;
    secrets: ServerSecrets;
    plugins: (FastifyPluginCallback | FastifyPluginAsync)[];
    multipartFSize: number;
    swaggerOpts: FastifyPluginOptions;
    swaggerUIOpts: FastifyPluginOptions;
    ajv: Ajv2020;

    constructor(
        host: string, port: number,
        oauth_clients: FastifyOAuth2Options[],
        rateLimitOptions: FastifyRegisterOptions<any>,
        routes: ServerRoute[],
        hooks: Partial<Record<FastifyHookName, any>> = {},
        secrets: ServerSecrets = {
            jwt: 'supersecret',
            cookie: 'supersecret'
        },
        plugins: (FastifyPluginCallback | FastifyPluginAsync)[] = [],
        multipartFSize: number = 10485760,
    ) {
        this.host = host;
        this.port = port;
        this.oauth_clients = oauth_clients;
        this.fastify = fastify;
        this.hooks = hooks;
        this.secrets = secrets;
        this.multipartFSize = multipartFSize;
        this.rateLimitOpts = rateLimitOptions;
        this.plugins = plugins;
        this.routes = routes;

        this.swaggerOpts = {
            openapi: {
                info: {
                    title: 'My API',
                    description: 'API documentation',
                    version: '1.0.0',
                },
                servers: [
                    { url: 'http://localhost:3000' }
                ],
            },
        };
        this.swaggerUIOpts = {
            routePrefix: '/docs',
            uiConfig: {
                docExpansion: 'full',
                deepLinking: false,
            },
            staticCSP: true,
            transformStaticCSP: (header: string): string => header,
        };
        this.ajv = new Ajv2020({ allErrors: true });
        addErrors(this.ajv);
        addFormats(this.ajv);
    }

    private async connectPrismaClient(): Promise<void> {
        await PrismaClientInstance.$connect();
        this.fastify.log.info('Prisma client connected ✅');
    }

    private addHooks(): void {
        for (const [key, handler] of Object.entries(this.hooks)) {
            if (handler) {
                this.fastify.addHook(key as ApplicationHook, handler);
            }
        }
    }

    private async registerPlugs(): Promise<void> {
        await this.fastify.register(fastifySwagger, this.swaggerOpts);
        await this.fastify.register(fastifySwaggerUi, this.swaggerUIOpts);
        await this.fastify.register(jwt, { secret: this.secrets.jwt });
        await this.fastify.register(fcookie, { secret: this.secrets.cookie });
        await this.fastify.register(multipart, {
            limits: { fileSize: this.multipartFSize }
        });
        await this.fastify.register(rateLimit, this.rateLimitOpts);
        await this.fastify.register(fcors, {
            origin: "http://localhost:5173",
            credentials: true
        });
        for (const plugin of this.plugins) {
            await this.fastify.register(plugin);
        }
        await this.registerOAuthClients();
        await fastify.register(websocket);
    }

    private registerRoutes(): void {
        for (const route of this.routes) {
            this.fastify.register(route.pcb, route.opt);
        }
    }

    private notFoundHandler(): any {
        return (request: FastifyRequest, reply: FastifyReply): void => {
            reply.code(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'doesn\'t exist, perhaps under construction. who knows 🤷!?'
            })
        };
    }

    private errorHandler(): any {
        return (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
            if (error.statusCode === 429) {
                reply.code(429);
                error.message = 'You\'ve Hit the Rate-Limit! chillax, haa bchwya ...!'
            }
            reply.send(error);
        };
    }

    private async registerOAuthClients(): Promise<void> {
        for (const clientOpt of this.oauth_clients) {
            await this.fastify.register(oauth2, clientOpt);
        }
    }

    private configureAJV(): void {
        for (const [type, schema] of Object.entries(chatSchema)) {
            wsValidators[type] = this.ajv.compile(schema as object);
        }
    }

    /**
     * Configures a custom JSON schema validator using AJV 2020-12 with enhanced features.
     * 
     * This validator supports:
     * - All validation errors collection (not just first error)
     * - Custom error messages via ajv-errors plugin
     * - Format validation (UUID, email, date, etc.) via ajv-formats plugin
     * 
     * @param {Object} options - Validator compiler options
     * @param {Object} options.schema - JSON schema to compile
     * @returns {Function} Compiled validation function
     * 
     * @example
     * // Schema with custom error and UUID format
     * const schema = {
     *   type: "object",
     *   properties: {
     *     id: { type: "string", format: "uuid" },
     *     email: { type: "string", format: "email", errorMessage: "Invalid email format" }
     *   }
     * };
     */
    private setValidatorCompiler(): void {
        this.fastify.setValidatorCompiler(({ schema }) => {
            const ajv = new (Ajv2020 as any)({ allErrors: true });
            (addErrors as any)(ajv); // Apply ajv-errors to the Ajv instance
            (addFormats as any)(ajv); // Apply ajv-formats to support uuid, email, etc.
            return ajv.compile(schema);
        });
    }

    private async start(): Promise<void> {
        try {
            await this.fastify.listen({
                host: this.host,
                port: this.port
            });
        } catch (error) {
            this.fastify.log.error(error);
            process.exit(0x1);
        }
    }

    public async run(): Promise<void> {
        this.configureAJV();
        this.setValidatorCompiler();
        await this.connectPrismaClient();
        this.addHooks();
        await this.registerPlugs();
        this.registerRoutes();
        this.fastify.setNotFoundHandler(
            { preHandler: (this.fastify as any).rateLimit() },
            this.notFoundHandler());
        this.fastify.setErrorHandler(
            this.errorHandler());
        await this.start();
    }

};

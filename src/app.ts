import { configDotenv } from "dotenv";
configDotenv();

import Server, { fastify } from "./server.js";
import Fastify from 'fastify';
import { config } from "dotenv";
import addErrors from "ajv-errors";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { prisma as PrismaClientInstance } from './utils/prisma.js';

config();

import jwt from '@fastify/jwt';
import fcookie from '@fastify/cookie';
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";

import LoggingOpts from './utils/logger.js';

import PreHandler from './hooks/pre.js'
import SendHandler from './hooks/send.js'
import CloseHandler from './hooks/close.js';

import UserRoutes from './routes/user.js';
import FriendRoutes from './routes/friend.js';
import AuthRoutes from './routes/auth.js';
import TOTPRoutes from './routes/totp.js';
// import TestRoutes from './routes/test.js';
import { chatRoom } from './routes/chat.js';

import JWTAuthenticationPlugin from './plugins/jwt.js';
import {facebookOAuthOpts, googleOAuthOpts} from "./auth/clients.js";
import ServiceManagerPlugin from './plugins/service.js';
import { chatSchema } from 'schemas/chat.js';
import type Ajv from 'ajv';

const ajv = new Ajv2020({ allErrors: true });
addErrors(ajv);
addFormats(ajv);

export const wsValidators: Record<string, Ajv.ValidateFunction> = {};
for (const [type, schema] of Object.entries(chatSchema)) {
  wsValidators[type] = ajv.compile(schema as object);
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
fastify.setValidatorCompiler(({ schema }) => {
  const ajv = new (Ajv2020 as any)({ allErrors: true });
  (addErrors as any)(ajv); // Apply ajv-errors to the Ajv instance
  (addFormats as any)(ajv); // Apply ajv-formats to support uuid, email, etc.
  return ajv.compile(schema);
});

await PrismaClientInstance.$connect();
fastify.log.info('Prisma connected ✅');

fastify.addHook('onClose', CloseHandler);
fastify.addHook('onSend', SendHandler);
fastify.addHook('preHandler', PreHandler);

fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "supersecret"
});
fastify.register(fcookie, {
    secret: process.env.CKE_SECRET || "supersecret",
    hook: 'preHandler'
});
fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

await fastify.register(websocket);

fastify.register(ServiceManagerPlugin);
fastify.register(JWTAuthenticationPlugin);

fastify.register(chatRoom, { prefix: '/v1' });
fastify.register(UserRoutes, { prefix: '/v1/user' });
// fastify.register(TestRoutes, { prefix: '/v1/user' });


[ 'SIGINT', 'SIGTERM' ]
    .forEach((sig) => {
        process.on(sig, () => {
            console.log(`\nReceived ${sig}, shutting down...`);

            fastify.close()
                .then(() => {
                    console.log("Fastify closed ✅");
                    process.exit(0);
                })
                .catch((err) => {
                    console.error(`Error closing Fastify: ${err.message}`);
                    process.exit(1);
                });
        });
});

const rateLimitingOpts = {
    global: true,
    max: 4,
    timeWindow: 10 * 1000,
    allowList: [],
    addHeaders: true
};

const routes = [
    {
        pcb: TOTPRoutes,
        opt: { prefix: '/v1/totp' }
    },
    {
        pcb: UserRoutes,
        opt: { prefix: '/v1/user' }
    },
    {
        pcb: FriendRoutes,
        opt: { prefix: '/v1/friend' }
    },
    {
        pcb: AuthRoutes,
        opt: { prefix: '/v1/auth' }
    }
]

const hooks = {
    'onClose': CloseHandler,
    'onSend': SendHandler,
    'preHandler': PreHandler,
};

const secrets = {
    jwt: process.env.JWT_SECRET || 'supersecret',
    cookie: process.env.CKE_SECRET || 'supersecret'
};

const app: Server = new Server(
    '0.0.0.0', 3000,
    [
        googleOAuthOpts,
        facebookOAuthOpts
    ],
    rateLimitingOpts, routes, hooks, secrets,
    [
        ServiceManagerPlugin,
        JWTAuthenticationPlugin
    ]
);

await app.run();

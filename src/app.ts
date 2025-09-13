import { configDotenv } from "dotenv";
configDotenv();

import Server, { fastify } from "./server.js";

import CloseHandler from './hooks/close.js';
import SendHandler from './hooks/send.js'
import PreHandler from './hooks/pre.js'

import UserRoutes from './routes/user.js';
import FriendRoutes from './routes/friend.js';
import AuthRoutes from './routes/auth.js';
import TOTPRoutes from './routes/totp.js';

import ServiceManagerPlugin from './plugins/service.js';
import JWTAuthenticationPlugin from './plugins/jwt.js';
import {facebookOAuthOpts, googleOAuthOpts} from "./auth/clients.js";



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

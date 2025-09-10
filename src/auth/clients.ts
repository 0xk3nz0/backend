import type { FastifyOAuth2Options } from "@fastify/oauth2";
import {
    googleOauthRedirectOpts
} from './consts.js';



export const googleOAuthOpts: FastifyOAuth2Options = {
    name: 'googleOAuth2',
    credentials: {
        client: {
            id: process.env.GOOGLE_CLIENT_ID!,
            secret: process.env.GOOGLE_CLIENT_SECRET!
        },
        auth: {
            authorizeHost: 'https://accounts.google.com',
            authorizePath: '/o/oauth2/v2/auth',
            tokenHost: 'https://www.googleapis.com',
            tokenPath: '/oauth2/v4/token'
        }
    },
    startRedirectPath: googleOauthRedirectOpts.redirectPath,
    callbackUri: googleOauthRedirectOpts.callbackUri,
    scope: [ 'profile', 'email' ]
};

import type { FastifyOAuth2Options } from "@fastify/oauth2";
import {
    facebookOauthRedirectOpts,
    googleOauthRedirectOpts
} from './consts.js';



/**
 * Google OAuth2 configuration for Fastify.
 *
 * @constant
 * @type {FastifyOAuth2Options}
 * @description
 * Configuration object for Google OAuth2 authentication in Fastify.
 * Includes client credentials, OAuth endpoints, redirect paths, and scopes.
 *
 * @see https://developers.google.com/identity/protocols/oauth2
 */
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

/**
 * Facebook OAuth2 configuration for Fastify.
 *
 * @constant
 * @type {FastifyOAuth2Options}
 * @description
 * Configuration object for Facebook OAuth2 authentication in Fastify.
 * Includes client credentials, OAuth endpoints, redirect paths, and scopes.
 *
 * @see https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow/
 */
export const facebookOAuthOpts: FastifyOAuth2Options = {
    name: 'facebookOAuth2',
    credentials: {
        client: {
            id: process.env.FACEBOOK_CLIENT_ID!,
            secret: process.env.FACEBOOK_CLIENT_SECRET!
        },
        auth: {
            authorizeHost: 'https://www.facebook.com',
            authorizePath: '/v12.0/dialog/oauth',
            tokenHost: 'https://graph.facebook.com',
            tokenPath: '/v12.0/oauth/access_token'
        }
    },
    startRedirectPath: facebookOauthRedirectOpts.redirectPath,
    callbackUri: facebookOauthRedirectOpts.callbackUri,
    scope: [ 'email', 'public_profile' ]
};

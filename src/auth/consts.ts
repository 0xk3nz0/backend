


const baseURL: string = 'http://localhost:3000';

/**
 * Type definition for OAuth redirect options.
 */
type clientOauthOpts = {
    redirectPath: string;
    callbackUri: string;
};

/**
 * Google OAuth redirect options.
 *
 * @constant
 * @type {clientOauthOpts}
 * @description
 * Defines the start path and callback URI for Google OAuth2 authentication.
 */
export const googleOauthRedirectOpts: clientOauthOpts = {
    redirectPath: '/v1/auth/google',
    callbackUri: `${baseURL}/v1/auth/google/callback`,
};

/**
 * Facebook OAuth redirect options.
 *
 * @constant
 * @type {clientOauthOpts}
 * @description
 * Defines the start path and callback URI for Facebook OAuth2 authentication.
 */
export const facebookOauthRedirectOpts: clientOauthOpts = {
    redirectPath: '/v1/auth/facebook',
    callbackUri: `${baseURL}/v1/auth/facebook/callback`,
};




const baseURL: string = 'http://localhost:3000';

type clientOauthOpts = {
    redirectPath: string;
    callbackUri: string;
}

export const googleOauthRedirectOpts: clientOauthOpts = {
    redirectPath: '/v1/auth/google',
    callbackUri: `${baseURL}/v1/auth/google/callback`,
}

export const facebookOauthRedirectOpts: clientOauthOpts = {
    redirectPath: '/v1/auth/facebook',
    callbackUri: `${baseURL}/v1/auth/facebook/callback`,
}

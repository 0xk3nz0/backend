/**
 * @note The provider is currently hardcoded at this point [line:14 & line:25].
 * @note A generic callbackController could be implemented to handle multiple providers dynamically,
 *       which would reduce repetition and make adding new providers easier.
 * @note This generic controller would typically use the OAuth "state" parameter to identify
 *       which provider initiated the request, allowing one route to handle all provider callbacks.
 * @note While more elegant in theory, this approach may introduce additional complexity
 *       that could make onboarding new contributors (e.g., @Aziz018) less straightforward.
 * @note Given that, keeping separate, simple callback controllers per provider
 *       is a conscious choice for clarity, maintainability, and team collaboration.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { authHelper } from "../utils/auth.js";



export const googleOAuthCallbackController = async (
    req: FastifyRequest, res: FastifyReply
): Promise<void> => {

    const token = await authHelper(req, res, 'google');
    res.code(200).send({
        access_token: token
    });

}

export const facebookOAuthCallbackController = async (
    req: FastifyRequest, res: FastifyReply
): Promise<void> => {

    const token = await authHelper(req, res, 'facebook');
    res.code(200).send({
        access_token: token
    });

}

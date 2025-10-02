


/**
 * Middleware that enforces authentication using a JWT stored in cookies.
 *
 * - Looks for the `access_token` cookie in the incoming request.
 * - If the token is missing, responds with `401 Unauthorized`.
 * - If present, verifies the token with `req.jwt.verify`.
 * - On success, attaches the decoded payload to `req.user`.
 *
 * @param {FastifyRequest} server - The Fastify request object.
 *                               Extended with:
 *                                  - `jwt` (from fastify-jwt)
 *                                  - `user` (decoded token payload).
 * @param {FastifyReply} token - The Fastify reply object, used to send error responses.
 *
 * @returns {Promise<void>} Resolves when authentication is validated.
 */
export const authenticateWebSocketToken = async (
    server: any, // The Fastify server instance (has JWT methods after plugin registration)
    token: string
): Promise<{ success: boolean; user?: any; error?: string }> => {
    try {
        if (!token) {
            return { success: false, error: 'No token provided' };
        }

        // Clean token (remove Bearer prefix if present)
        const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
        
        // Verify using server's JWT plugin
        const decoded = server.jwt.verify(cleanToken);
        
        // Validate token structure
        if (!decoded || typeof decoded !== 'object' || !decoded.uid) {
            return { success: false, error: 'Invalid token payload' };
        }
        
        return { success: true, user: decoded };
        
    } catch (error: any) {
        let errorMessage = 'Authentication failed';
        
        switch (error.code) {
            case 'FAST_JWT_EXPIRED':
                errorMessage = 'Token expired';
                break;
            case 'FAST_JWT_MALFORMED':
                errorMessage = 'Invalid token format';
                break;
            case 'FAST_JWT_INVALID_SIGNATURE':
                errorMessage = 'Invalid token signature';
                break;
        }
        
        return { success: false, error: errorMessage };
    }
};


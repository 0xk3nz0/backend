import qrcode from "qrcode";
import type { FastifyInstance } from "fastify";
import speakeasy, { type Encoding } from "speakeasy";

import ServiceError, { type ServiceError_t } from "../utils/service-error.js";
import DataBaseWrapper from "../utils/prisma.js";
import type { TOTPServiceError_t } from "./user.js";
import type UserModel from "../models/user.js";



/**
 * Custom error class for handling TOTP-related service errors.
 *
 * Extends the generic `ServiceError` and initializes
 * predefined error codes/messages for TOTP operations.
 */
class TOTPServiceError extends ServiceError {

    constructor() {
        super();
        this.setupCodes();
    }

    /**
     * Setup error codes/messages for TOTP errors.
     * TODO: Implement mapping of codes → messages.
     *
     * @returns {void}
     */
    setupCodes(): void {
        /// ... add codes later
    }
}

/**
 * Service class for managing TOTP (Time-based One-Time Password) operations.
 *
 * Wraps around Speakeasy for generating and verifying TOTP secrets,
 * and integrates with the database for storing user secrets.
 *
 * @extends DataBaseWrapper
 */
export default class TOTPService extends DataBaseWrapper {

    errorHandler: TOTPServiceError;
    speakEasyConfig: any;

    constructor(fastify: FastifyInstance) {
        super('totp.service', fastify);
        this.errorHandler = new TOTPServiceError();
        this.speakEasyConfig = {
            secretKeyLength: 0x14, // 20 bytes
            digits: 0x6,          // 6 digits
            encoding: 'base32',   // encoding format
            step: 0x1e            // 30 seconds
        };
    }

    /**
     * Throws a TOTP-specific error or a generic fallback error.
     *
     * @param {ServiceError_t | undefined} err - The service error object, if any.
     * @throws {TOTPServiceError_t | Error} Throws formatted error.
     */
    throwErr(err: ServiceError_t | undefined) {
        if (err !== undefined) {
            const e: TOTPServiceError_t = Object.assign(new Error(err.message), {
                code: err.code,
                message: err.message
            });
            throw e;
        } else {
            throw Error("Unknown Error Occured!");
        }
    }

    /**
     * Generates a new TOTP secret for a user.
     *
     * @returns {string} The generated secret encoded according to `speakEasyConfig.encoding`.
     */
    public generateSecret(): string {
        const secretKey = speakeasy.generateSecret({
            length: this.speakEasyConfig.secretKeyLength
        });

        switch (this.speakEasyConfig.encoding) {
            case "base32": return secretKey.base32;
            case "ascii": return secretKey.ascii;
            case "hex": return secretKey.hex;
            default: return secretKey.base32;
        }
    }

    /**
     * Verifies a TOTP token against a secret.
     *
     * @param {string} secret - The user's TOTP secret.
     * @param {string} token - The TOTP token to verify.
     * @returns {boolean} `true` if valid, otherwise `false`.
     */
    public verify(secret: string, token: string): boolean {
        return speakeasy.totp.verify({
            secret,
            token,
            encoding: this.speakEasyConfig.encoding as Encoding,
            digits: this.speakEasyConfig.digits,
            step: this.speakEasyConfig.step
        });
    }

    /**
     * Generates an otpauth:// URL for use in authenticator apps.
     *
     * @param {string} secret - The TOTP secret.
     * @param {string} label - Label to display in the authenticator app.
     * @param {string} issuer - The service issuer (e.g., app name).
     * @returns {string} The otpauth URL.
     */
    public getOTPAuthUrl(secret: string, label: string, issuer: string): string {
        return speakeasy.otpauthURL({
            secret,
            label,
            type: 'totp',
            issuer,
            encoding: this.speakEasyConfig.encoding as Encoding,
            digits: this.speakEasyConfig.digits
        });
    }

    /**
     * Retrieves the TOTP secret for a user.
     *
     * @param {string} uid - The user ID.
     * @returns {Promise<string>} The user's TOTP secret.
     * @throws {TOTPServiceError_t} If the user is not found or 2FA is disabled.
     */
    public async getUserSecret(uid: string): Promise<string> {
        const user = await this.prisma.user.findUnique({ where: { id: uid } });

        if (!user) {
            this.throwErr({ code: 404, message: 'user not found' });
        }

        if (user!.secret === null) {
            this.throwErr({ code: 400, message: `2fa is disabled for ${uid}` });
        }

        return user!.secret!;
    }

    /**
     * Checks whether a user has 2FA enabled.
     *
     * @param {string} uid - The user ID.
     * @returns {Promise<boolean>} `true` if 2FA is enabled, otherwise `false`.
     */
    public async status(uid: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({ where: { id: uid } });

        if (!user) {
            this.throwErr({ code: 404, message: 'user not found' });
        }

        return user!.secret !== null;
    }

    /**
     * Enables 2FA for a user by generating and storing a new secret.
     *
     * @param {string} uid - The user ID.
     * @returns {Promise<UserModel | null>} The updated user object.
     * @throws {TOTPServiceError_t} If 2FA is already enabled.
     */
    public async enable(uid: string): Promise<UserModel | null> {
        if (await this.status(uid)) {
            this.throwErr({ code: 409, message: `2fa already enabled for ${uid}` });
        }

        const user: UserModel | null = await this.prisma.user.update({
            where: { id: uid },
            data: { secret: this.fastify.service.totp.generateSecret() }
        });

        return user;
    }

    /**
     * Disables 2FA for a user by removing their secret.
     *
     * @param {string} uid - The user ID.
     * @returns {Promise<UserModel | null>} The updated user object.
     * @throws {TOTPServiceError_t} If 2FA is already disabled.
     */
    public async disable(uid: string): Promise<UserModel | null> {
        if (!(await this.status(uid))) {
            this.throwErr({ code: 409, message: `2fa already disabled for ${uid}` });
        }

        const user: UserModel | null = await this.prisma.user.update({
            where: { id: uid },
            data: { secret: null }
        });

        return user;
    }
}

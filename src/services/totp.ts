import qrcode from "qrcode";
import type { FastifyInstance } from "fastify";
import speakeasy, { type Encoding } from "speakeasy";

import ServiceError, { type ServiceError_t } from "../utils/service-error.js";
import DataBaseWrapper from "../utils/prisma.js";
import type { TOTPServiceError_t } from "./user.js";
import type UserModel from "../models/user.js";



class TOTPServiceError extends ServiceError {

    constructor() {
        super();
        this.setupCodes();
    }

    setupCodes(): void {
        /// ... add codes later
    }

}

export default class TOTPService extends DataBaseWrapper {

    errorHandler: TOTPServiceError;
    speakEasyConfig: any;

    constructor(fastify: FastifyInstance) {
        super('totp.service', fastify);
        this.errorHandler = new TOTPServiceError();
        this.speakEasyConfig = {
            secretKeyLength: 0x14,
            digits: 0x6,
            encoding: 'base32',
            step: 0x1e
        };
    }

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

    public generateSecret(): string {

        const secretKey = speakeasy.generateSecret({
            length: this.speakEasyConfig.secretKeyLength
        });

        switch (this.speakEasyConfig.encoding) {

            case "base32": {
                return secretKey.base32;
            }

            case "ascii": {
                return secretKey.ascii;
            }

            case "hex": {
                return secretKey.hex;
            }

            default: {
                return secretKey.base32;
            }
        }

    }

    public verify(secret: string, token: string): boolean {
        return speakeasy.totp.verify({
            secret,
            token,
            encoding: this.speakEasyConfig.encoding as Encoding,
            digits: this.speakEasyConfig.digits,
            step: this.speakEasyConfig.step
        });
    }

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

    public async getUserSecret(uid: string): Promise<string> {

        const user = await this.prisma.user.findUnique({
            where: { id: uid }
        });

        if (!user) {
            this.throwErr({
                code: 404,
                message: 'user not found'
            });
        }

        if (user!.secret === null) {
            this.throwErr({
                code: 400,
                message: `2fa is disabled for ${uid}`
            });
        }

        return user!.secret!;
    }

    /// this checks if the user with uid = uid has enabled the 2FA mechanism
    public async status(uid: string): Promise<boolean> {

        const user = await this.prisma.user.findUnique({
            where: { id: uid }
        });
        if (!user) {
            this.throwErr({
                code: 404,
                message: 'user not found'
            });
        }

        /// true user has 2fa false he hasn't yet enabled it !
        return user!.secret !== null;
    }

    public async enable(uid: string): Promise<UserModel | null> {

        if (await this.status(uid)) {
            this.throwErr({
                code: 409,
                message: `2fa already enabled for ${uid}`
            });
        }
        const user: UserModel | null = await this.prisma.user.update({
            where: { id: uid },
            data: { secret: this.fastify.service.totp.generateSecret() }
        });

        return user;

    }

    public async disable(uid: string): Promise<UserModel | null> {

        if (!(await this.status(uid))) {
            this.throwErr({
                code: 409,
                message: `2fa already disabled for ${uid}`
            });
        }
        const user: UserModel | null = await this.prisma.user.update({
            where: { id: uid },
            data: { secret: null }
        });

        return user;

    }

}

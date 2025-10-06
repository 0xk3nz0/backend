import type { FastifyInstance } from "fastify";

import DataBaseWrapper from "../utils/prisma.js";
import type UserModel from "../models/user.js";
import { Prisma, type User } from "../generated/prisma/index.js";
import ServiceError, {type BaseServiceError_t, type ServiceError_t} from "../utils/service-error.js";



export type UserServiceError_t = BaseServiceError_t;
export type FriendServiceError_t = BaseServiceError_t;
export type AuthServiceError_t = BaseServiceError_t;
export type TOTPServiceError_t = BaseServiceError_t;

/**
 * UserServiceError
 *
 * Specialized error handler for user-related service operations.
 * Extends the abstract ServiceError class to map specific Prisma error codes
 * (such as unique constraint violations and record not found) to HTTP status codes
 * and user-friendly error messages for the UserService.
 *
 * Responsibilities:
 * - Define and register error code mappings relevant to user operations.
 * - Provide consistent error responses for user CRUD actions.
 *
 * Example mapped codes:
 *   - P2025: User record doesn't exist (404)
 *   - P2002: User record already exists (409)
 */
class UserServiceError extends ServiceError {

    constructor () {
        super();
        this.setupCodes();
    }

    setupCodes(): void {
        this.codes.push(...[
            {
                'P2025': {
                    code: 404,
                    message: "user record doesn't exist!"
                }
            },
            {
                'P2002': {
                    code: 409,
                    message: "user record already exist!"
                }
            },
            /// add more codes
        ]);
    }

};

/**
 * UserService
 *
 * Provides high-level database operations for the `User` entity,
 * abstracting direct PrismaClient calls behind a service layer.
 *
 * Responsibilities:
 * - Create, update, delete, and query user records in the database.
 * - Ensure consistent error handling and logging for Prisma operations.
 * - Return simple, predictable values (`true`/`false`, `null`, or results)
 *   instead of propagating raw Prisma exceptions.
 *
 * This service extends {@link DataBaseWrapper} to reuse a shared PrismaClient
 * instance and Fastify logger, making it suitable for integration as part of
 * the Fastify service layer (e.g. via decorators or a service container).
 * 
 * @note this should be refactored for better error handling!
 */
export default class UserService extends DataBaseWrapper {

    errorHandler: UserServiceError;

    constructor(fastify: FastifyInstance) {
        super('user.service', fastify);
        this.errorHandler = new UserServiceError();
    }

    throwErr(err: ServiceError_t | undefined) {
        if (err !== undefined) {
            const e: UserServiceError_t = Object.assign(new Error(err.message), {
                code: err.code,
                message: err.message
            });
            throw e;
        } else {
            throw Error("Unknown Error Occured!");
        }
    }

    /**
     * Handles and logs errors that occur during Prisma operations.
     * Differentiates between known Prisma errors (e.g. P2025: record not found),
     * generic JS errors, and unknown error types.
     *
     * @param error - The error thrown by a Prisma query or runtime issue.
     * @deprecated interact with errorHandler <UserServiceError> instead!
     */
    private _handleError(error: any | unknown): void {
        /// deprecated
    }

    /**
     * Creates a new user record in the database.
     *
     * @param user - User data to insert.
     * @returns `true` if creation succeeded, otherwise `false`.
     */
    public async create(user: UserModel): Promise<UserModel | Error> {
        try {
            return await this.prisma.user.create({
                data: {
                    name: user.name,
                    email: user.email,
                    password: user.password
                }
            });
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error);
            if (err === undefined) {
                throw Error("unknown error!");
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Updates an existing user by a unique identifier.
     *
     * @param where - Unique condition (e.g. `{ id: "uuid" }`, `{ email: "foo@bar.com" }`).
     * @param data - Fields and values to update.
     * @returns `true` if the update succeeded, otherwise `false`.
     */
    public async updateBy(
        where: Prisma.UserWhereUniqueInput,
        data: Prisma.UserUpdateInput
    ): Promise<boolean> {
        try {
            await this.prisma.user.update({ where, data });
            return true;
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error);
            if (err === undefined) {
                return false;
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Deletes a single user by a unique identifier.
     *
     * @param where - Unique condition (e.g. `{ id: "uuid" }`, `{ email: "foo@bar.com" }`).
     * @returns `true` if the deletion succeeded, otherwise `false`.
     */
    public async deleteBy(
        where: Prisma.UserWhereUniqueInput
    ): Promise<boolean> {
        try {
            await this.prisma.user.delete({ where });
            return true;
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error);
            if (err === undefined) {
                return false;
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Deletes all user records from the database.
     *
     * @returns The number of deleted records, or `null` if an error occurred.
     */
    public async deleteAll(): Promise<number | null> {
        try {
            return (await this.prisma.user.deleteMany()).count;
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error);
            if (err === undefined) {
                return null;
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Fetches a single user by a unique identifier.
     *
     * @param where - Unique condition (e.g. `{ id: "uuid" }`, `{ email: "foo@bar.com" }`).
     * @returns A `UserModel` if found, otherwise `null`.
     */
    public async fetchBy(
        where: Prisma.UserWhereUniqueInput
    ): Promise<UserModel | null> {
        try {
            return await this.prisma.user.findUnique({ where });
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error);
            if (err === undefined) {
                return null;
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Fetches all users in the database.
     *
     * @returns An array of `UserModel` objects, or `null` if an error occurred.
     */
    public async fetchAll(): Promise<Array<UserModel | null> | null> {
        try {
            return await this.prisma.user.findMany();
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error);
            if (err === undefined) {
                return null;
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Fetches users that match a set of conditions.
     *
     * @param where - Filtering conditions (e.g. `{ role: "ADMIN" }`).
     * @returns An array of `UserModel` objects that satisfy the conditions, or `null` if an error occurred.
     */
    public async filterBy(
        where: Prisma.UserWhereInput
    ): Promise<Array<UserModel | null> | null> {
        try {
            return await this.prisma.user.findMany({ where });
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error);
            if (err === undefined) {
                return null;
            } else {
                throw this.throwErr(err);
            }
        }
    }

};

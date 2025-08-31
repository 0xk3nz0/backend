import type { FastifyInstance } from "fastify";

import DataBaseWrapper from "../utils/prisma.js";
import type UserModel from "../models/user.js";
import { Prisma } from "../generated/prisma/index.js";



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
 */
export default class UserService extends DataBaseWrapper {

    constructor(fastify: FastifyInstance) {
        super('user.service', fastify);
    }

    /**
     * Handles and logs errors that occur during Prisma operations.
     * Differentiates between known Prisma errors (e.g. P2025: record not found),
     * generic JS errors, and unknown error types.
     *
     * @param error - The error thrown by a Prisma query or runtime issue.
     */
    private _handleError(error: any | unknown): void {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2025" ) {
                this.fastify.log.error(`[${this.service}] deleteBy(key, val) -> user record doesn't exist!`);
            } else {
                this.fastify.log.error(`[${this.service}] deleteBy(key, val) -> Prisma error code: ${error.code}`);
            }
        } else if (error instanceof Error) {
            this.fastify.log.error(`[${this.service}] deleteBy(key, val) -> ${error.message}`);
        } else {
            this.fastify.log.error(`[${this.service}] deleteBy(key, val) -> ${error}`);
        }
    }

    /**
     * Creates a new user record in the database.
     *
     * @param user - User data to insert.
     * @returns `true` if creation succeeded, otherwise `false`.
     */
    public async create(user: UserModel): Promise<boolean> {
        try {
            await this.prisma.user.create({ data: { ...user } });
            return true;
        } catch (error) {
            this._handleError(error);
            return false;
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
        } catch (error) {
            this._handleError(error);
            return false;
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
        } catch (error) {
            this._handleError(error);
            return false;
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
        } catch (error) {
            this._handleError(error);
            return null;
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
        } catch (error) {
            this._handleError(error);
            return null;
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
        } catch (error) {
            this._handleError(error);
            return null;
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
        } catch (error) {
            this._handleError(error);
            return null;
        }
    }

};

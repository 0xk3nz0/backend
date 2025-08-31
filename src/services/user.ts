import type { FastifyInstance } from "fastify";

import DataBaseWrapper from "../utils/prisma.js";
import type UserModel from "../models/user.js";
import { Prisma } from "../generated/prisma/index.js";



export default class UserService extends DataBaseWrapper {

    /**
     * Initializes the UserService with a Fastify instance and service name.
     * @param fastify - Fastify instance for logging and dependency injection
     */
    constructor(fastify: FastifyInstance) {
        super('user.service', fastify);
    }

    /**
     * Internal error handler for Prisma operations.
     * Logs errors from PrismaClientKnownRequestError and generic Errors.
     * @param error - The error object caught from a Prisma operation
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
     * Creates a new user in the database.
     * @param user - UserModel object containing user data
     * @returns `true` if the user was created successfully, `false` if an error occurred
     */
    async create(user: UserModel): Promise<boolean> {
        try {
            await this.prisma.user.create({ data: { ...user } });
            return true;
        } catch (error) {
            this._handleError(error);
            return false;
        }
    }

    /**
     * Updates a specific field of a user identified by a unique key.
     * @param f_key - Unique field to identify the user (e.g., "id" or "email")
     * @param f_val - Value of the unique field
     * @param key - Field to update
     * @param val - New value for the field
     * @returns `true` if the update was successful, `false` if an error occurred
     */
    async updateBy<K extends keyof Prisma.UserWhereUniqueInput>(
        f_key: K,
        f_val: Prisma.UserWhereUniqueInput[K],
        key: K,
        val: Prisma.UserWhereUniqueInput[K]
    ): Promise<boolean> {
        try {
            await this.prisma.user.update({
                where: { [f_key]: f_val } as unknown as Prisma.UserWhereUniqueInput,
                data: { [key]: val as unknown as Prisma.UserWhereUniqueInput }
            });
            return true;
        } catch (error) {
            this._handleError(error);
            return false;
        }
    }

    /**
     * Deletes a user from the database by a unique field.
     * @param key - Unique field to identify the user (e.g., "id" or "email")
     * @param val - Value of the unique field
     * @returns `true` if deletion succeeded, `false` otherwise
     */
    async deleteBy<K extends keyof Prisma.UserWhereUniqueInput>(
        key: K,
        val: Prisma.UserWhereUniqueInput[K]
    ): Promise<boolean> {
        try {
            await this.prisma.user.delete({
                where: { [key]: val } as unknown as Prisma.UserWhereUniqueInput
            });
            return true;
        } catch (error) {
            this._handleError(error);
            return false;
        }
    }

    /**
     * Deletes all users from the database.
     * @returns The number of users that were deleted
     */
    async deleteAll(): Promise<number> {
        return (await this.prisma.user.deleteMany()).count;
    }

    /**
     * Fetches a single user by a unique field.
     * @param key - Unique field to identify the user
     * @param val - Value of the unique field
     * @returns The matching UserModel if found, otherwise `null`
     */
    async fetchBy<K extends keyof Prisma.UserWhereUniqueInput>(
        key: K,
        val: Prisma.UserWhereUniqueInput[K]
    ): Promise<UserModel | null> {
        return await this.prisma.user.findUnique({
            where: { [key]: val } as unknown as Prisma.UserWhereUniqueInput
        });
    }

    /**
     * Fetches all users from the database.
     * @returns An array of all UserModel objects
     */
    async fetchAll(): Promise<Array<UserModel | null>> {
        this.fastify.log.debug("WAAAAL9LAAAWIIII !!!");
        return await this.prisma.user.findMany();
    }

    /**
     * Fetches users filtered by a non-unique field.
     * @param key - Field to filter by (e.g., "role" or "isActive")
     * @param val - Value to match for the field
     * @returns An array of matching UserModel objects
     */
    async filterBy<K extends keyof Prisma.UserWhereInput>(
        key: K,
        val: Prisma.UserWhereInput[K]
    ): Promise<Array<UserModel | null>> {
        return await this.prisma.user.findMany({
            where: { [key]: val } as unknown as Prisma.UserWhereInput
        });
    }

};

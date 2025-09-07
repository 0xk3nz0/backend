import type {FastifyInstance} from "fastify";

import DataBaseWrapper from "../utils/prisma.js";
import ServiceError, {type BaseServiceError_t, type ServiceError_t} from "../utils/service-error.js";
import type {UserServiceError_t} from "./user.js";
import type FriendRequest from "../models/friend.js";



export type FriendServiceError_t = BaseServiceError_t;

class FriendServiceError extends ServiceError {

    constructor() {
        super();
        this.setupCodes();
    }

    setupCodes(): void {
        /// ... add codes later
    }

};

/**
 * FriendService handles operations related to friend requests between users.
 * Extends the DataBaseWrapper for Prisma database interactions.
 *
 * Responsibilities include sending, accepting, declining friend requests,
 * and fetching friends or pending requests.
 */
export default class FriendService extends  DataBaseWrapper {

    errorHandler: FriendServiceError;

    constructor(fastify: FastifyInstance) {
        super('friend.service', fastify);
        this.errorHandler = new FriendServiceError();
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
     * Creates a friend request in the database between two users.
     * @param sender_id - ID of the user sending the request
     * @param receiver_id - ID of the user receiving the request
     * @returns The created FriendRequest object
     * @private
     */
    private async craftRequest(sender_id: string, receiver_id: string): Promise<FriendRequest> {
        let request = await this.prisma.friendRequest.create({
            data: {
                requested: { connect: { id: sender_id } },
                requester: { connect: { id: receiver_id } }
            },
            include: {
                requested: true,
                requester: true
            }
        });

        return {
            id: request.id,
            requester: request.requester,
            requested: request.requested,
            status: request.status,
            timestamp: request.timestamp,
            requesterId: request.requesterId,
            requestedId: request.requestedId
        }
    }

    /**
     * Sends a friend request from one user to another.
     * @param sender_uid - ID of the user sending the request
     * @param receiver_uid - ID of the user receiving the request
     * @returns The created FriendRequest object
     * @throws Error if either user ID is invalid
     */
    public async sendRequest(sender_uid: string, receiver_uid: string): Promise<FriendRequest> {
        if (
            await this.fastify.service.user.fetchBy({ id: sender_uid }) === null ||
            await this.fastify.service.user.fetchBy({ id: receiver_uid }) === null
        ) {
            throw Error(`[${this.service}] | sendRequest(sender_uid, receiver_uid) -> valid user id's are required!`);
        } else {
            return this.craftRequest(sender_uid, receiver_uid);
        }
    }

    /**
     * Accepts a friend request by updating its status to "ACCEPTED".
     * @param request_id - ID of the friend request to accept
     * @throws Error if the update fails or an unknown error occurs
     */
    public async acceptRequest(request_id: string): Promise<void> {
        try {
            await this.prisma.friendRequest.update({
                where: { id: request_id },
                data: { status: "ACCEPTED" }
            });
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error
            );
            if (err === undefined) {
                throw Error("unknown error!");
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Declines a friend request by updating its status to "REJECTED".
     * @param request_id - ID of the friend request to decline
     * @throws Error if the update fails or an unknown error occurs
     */
    public async declineRequest(request_id: string): Promise<void> {
        try {
            await this.prisma.friendRequest.update({
                where: { id: request_id },
                data: { status: "REJECTED" }
            });
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error
            );
            if (err === undefined) {
                throw Error("unknown error!");
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Fetches a list of accepted friends for a given user.
     * @param uid - User ID for whom to fetch friends
     * @returns Array of user IDs that are accepted friends
     * @throws Error if the query fails or an unknown error occurs
     */
    public async getFriends(uid: string): Promise<string[]> {
        try {
            const acceptedRequests: FriendRequest[] = await this.prisma.friendRequest.findMany(
                {
                    where: {
                        status: "ACCEPTED",
                        requesterId: uid
                    },
                    include: {
                        requested: true,
                        requester: true
                    }
                }
            );
            let friends: string[] = [];
            for (const request of acceptedRequests) {
                if (request.requestedId) {
                    friends.push(request.requestedId);
                }
            }
            return friends;
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error
            );
            if (err === undefined) {
                throw Error("unknown error!");
            } else {
                throw this.throwErr(err);
            }
        }
    }

    /**
     * Fetches a list of pending friend requests for a given user.
     * @param uid - User ID for whom to fetch pending requests
     * @returns Array of FriendRequest objects with status "PENDING"
     * @throws Error if the query fails or an unknown error occurs
     */
    public async getPendingRequests(uid: string): Promise<FriendRequest[]> {
        try {
            return this.prisma.friendRequest.findMany(
                {
                    where: {
                        status: "PENDING",
                        requesterId: uid
                    },
                    include: {
                        requested: true,
                        requester: true
                    }
                }
            );
        } catch (error: any) {
            let err = this.errorHandler.handleError(
                this.fastify, this.service, error
            );
            if (err === undefined) {
                throw Error("unknown error!");
            } else {
                throw this.throwErr(err);
            }
        }
    }

}

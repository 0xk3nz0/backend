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

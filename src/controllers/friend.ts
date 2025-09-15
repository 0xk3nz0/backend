import type FriendRequest from "../models/friend.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { BlockUserInput, SendFriendRequestInput } from "../models/friend.js";
import type { ResolveFriendRequestInput } from "../models/friend.js";
import type FriendService from "../services/friend.js";
import { isServiceError } from "../utils/service-error.js";



export const sendFriendRequestController = async (
    req: FastifyRequest<{ Body: SendFriendRequestInput }>, res: FastifyReply
): Promise<void> => {
    try {
        const friendReq: FriendRequest | undefined = await req.server.service.friend.sendRequest(
            req.user.uid, req.body.requested_uid);
        res.code(200).send({
            request: friendReq
        });
    } catch (e: unknown) {
        if (isServiceError(e)) {
            res.code(e.code).send({
                message: e.message
            });
        } else {
            throw e;
        }
    }
}

export const resolveFriendRequestController = async (
    req: FastifyRequest<{ Body: ResolveFriendRequestInput }>, res: FastifyReply
): Promise<void> => {
    const friendMS: FriendService = req.server.service.friend;
    const incomingFReqs: FriendRequest[] = await friendMS.getIncomingRequests(
        req.user.uid
    );
    req.server.log.debug(incomingFReqs);
    const targetFReq: FriendRequest | undefined = incomingFReqs
        .filter((freq) => freq.id === req.body.request_id)[0];
    if (!targetFReq) {
        res.code(404).send({
            message: "Friend request not found"
        });
    } else {
        if (!targetFReq.id) {
            throw Error(`resolveFriendRequestController(req, res) -> Friend requested with id ${targetFReq.id}`);
        } else {
            let message: string;
            let newStatus: string;
            if (req.body.action) {
                await friendMS.acceptRequest(targetFReq.id);
                message = "now you are friends";
                newStatus = "ACCEPTED";
            } else {
                await friendMS.declineRequest(targetFReq.id);
                message = "why are you lonely?";
                newStatus = "REJECTED";
            }
            res.code(200).send({ message, newStatus });
        }
    }
}

export const getFriendsController = async (
    req: FastifyRequest, res: FastifyReply
): Promise<void> => {
    const friendMS: FriendService = req.server.service.friend;
    const friends: string[] = await friendMS.getFriends(req.user.uid);
    res.code(200).send(friends);
}

export const getPendingRequestsController = async (
    req: FastifyRequest, res: FastifyReply
): Promise<void> => {
    const pendingFriendRequests: FriendRequest[] = await req.server.service.friend
        .getPendingRequests(req.user.uid);
    const pendingFriendIds: string[] = pendingFriendRequests
        .map((freq) => freq.id)
        .filter((fid) => fid !== undefined);
    res.code(200).send(pendingFriendIds);
}

export const getIncomingRequestsController = async (
    req: FastifyRequest, res: FastifyReply
): Promise<void> => {
    const incomingFriendRequests: FriendRequest[] = await req.server.service.friend
        .getIncomingRequests(req.user.uid);
    const incomingFriendIds: string[] = incomingFriendRequests
        .map((freq) => freq.id)
        .filter((fid) => fid !== undefined);
    res.code(200).send(incomingFriendIds);
}

export const blockUserController = async (
    req: FastifyRequest<{ Body: BlockUserInput }>, rep: FastifyReply
): Promise<void> => {
    try {
        await req.server.service.friend.blockUser(
            req.user.uid,
            req.body.blocked_uid
        );
        rep.code(200).send({
            message: 'user blocked successfully'
        });
    } catch (e: unknown) {
        if (isServiceError(e)) {
            rep.code(e.code).send({
                message: e.message
            });
        } else {
            throw e;
        }
    }
}

export const unblockUserController = async (
    req: FastifyRequest<{ Body: BlockUserInput }>, rep: FastifyReply
): Promise<void> => {
    try {
        await req.server.service.friend.unblockUser(
            req.user.uid,
            req.body.blocked_uid
        );
        rep.code(200).send({
            message: 'user unblocked successfully'
        });
    } catch (e: unknown) {
        if (isServiceError(e)) {
            rep.code(e.code).send({
                message: e.message
            });
        } else {
            throw e;
        }
    }
}

export const getBlockedUsersController = async (
    req: FastifyRequest,
    rep :FastifyReply
): Promise<void> => {
    const blockedUsers = await req.server.service.friend.getBlockedUsers(req.user.uid);
    rep.code(200).send(blockedUsers);
}

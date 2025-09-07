import type FriendRequest from "../models/friend.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { SendFriendRequestInput } from "../models/friend.js";
import type { ResolveFriendRequestInput } from "../models/friend.js";
import type FriendService from "../services/friend.js";



export const sendFriendRequestController = async (
    req: FastifyRequest<{ Body: SendFriendRequestInput }>, res: FastifyReply
): Promise<void> => {
    const friendReq: FriendRequest = await req.server.service.friend.sendRequest(
        req.user.uid, req.body.requested_uid);
    res.code(200).send({
        request: friendReq
    });
}

export const resolveFriendRequestController = async (
    req: FastifyRequest<{ Body: ResolveFriendRequestInput }>, res: FastifyReply
): Promise<void> => {
    const friendMS: FriendService = req.server.service.friend;
    const pendingFReqs: FriendRequest[] = await friendMS.getPendingRequests(
        req.user.uid
    );
    const targetFReq: FriendRequest | undefined = pendingFReqs
        .filter((freq) => freq.requestedId === req.body.requested_uid)[0];
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
    res.code(200).send({
        friendIds: friends
    });
}

export const getPendingRequestsController = async (
    req: FastifyRequest, res: FastifyReply
): Promise<void> => {
    const pendingFriendRequests: FriendRequest[] = await req.server.service.friend
        .getPendingRequests(req.user.uid);
    const pendingFriendIds: string[] = pendingFriendRequests
        .map((freq) => freq.id)
        .filter((fid) => fid !== undefined);
    res.code(200).send({
        friendPendingIds: pendingFriendIds
    });
}

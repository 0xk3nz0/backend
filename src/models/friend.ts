import type UserModel from "./user.js";
import type {FriendRequestStatus} from "../types/friend.js";



export type FriendRequestStatus_t = (typeof FriendRequestStatus)[keyof typeof FriendRequestStatus]

export interface SendFriendRequestInput {
    requested_uid: string;
};

export interface ResolveFriendRequestInput {
    request_id: string;
    action: boolean;
};

export default interface FriendRequest {
    id?: string;
    requester: UserModel;
    requested: UserModel;
    status?: FriendRequestStatus_t;
    timestamp?: Date;
    requesterId?: string;
    requestedId?: string;
};

import type UserModel from "./user.js";
import type { FriendRequestStatus } from "../types/friend.js";



/**
 * Type representing the possible status values of a friend request.
 */
export type FriendRequestStatus_t = (typeof FriendRequestStatus)[keyof typeof FriendRequestStatus]

/**
 * Represents a friend request between two users.
 *
 * @property {string} id - Unique request ID
 * @property {UserModel} requester - User who sent the request
 * @property {UserModel} requested - User who received the request
 * @property {FriendRequestStatus_t} status - Current request status (pending, accepted, rejected)
 * @property {Date} timestamp - When the request was created
 * @property {string} requesterId - ID of the requester (for DB reference)
 * @property {string} requestedId - ID of the requested (for DB reference)
 */
export default interface FriendRequest {
    id?: string;
    requester: UserModel;
    requested: UserModel;
    status?: FriendRequestStatus_t;
    timestamp?: Date;
    requesterId?: string;
    requestedId?: string;
}

/**
 * Input for sending a friend request.
 *
 * @property {string} requested_uid - ID of the user to send a request to
 */
export interface SendFriendRequestInput {
    requested_uid: string;
}

/**
 * Input for resolving a friend request.
 *
 * @property {string} request_id - ID of the request to resolve
 * @property {boolean} action - Accept (true) or Reject (false)
 */
export interface ResolveFriendRequestInput {
    request_id: string;
    action: boolean;
}

export interface BlockUserInput {
    blocked_uid: string;
}

export interface BlockedUserModel {
    id: string;
    blockerId: string;
    blockedId: string;
    timestamp: Date;
    blocker?: UserModel;
    blocked?: UserModel;
}

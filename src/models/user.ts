import type FriendRequest from "./friend.js";



/**
 * Payload stored inside JWT for a user.
 *
 * @property {string} uid - Unique user ID
 * @property {string} createdAt - User creation timestamp
 */
export type UserJWTPayload = {
    uid: string;
    createdAt: string;
    mfa_required: boolean;
}

/**
 * Input for updating a user field.
 *
 * @property {string} field - The field to update (e.g., 'name', 'email')
 * @property {string} value - The new value for the field
 */
export interface UserUpdateInput {
    field: string;
    value: string;
}

/**
 * Input for user login.
 *
 * @property {string} email - User's email address
 * @property {string} password - User's password
 */
export interface UserLoginInput {
    email: string;
    password: string;
}

/**
 * Input for user registration.
 *
 * @property {string} name - User's display name
 * @property {string} email - User's email address
 * @property {string} password - User's password
 */
export interface UserRegisterInput {
    name: string;
    email: string;
    password: string;
}

/**
 * Information returned by an OAuth provider about a user.
 *
 * @property {string} id - Provider-specific user ID
 * @property {string} email - User's email
 * @property {boolean} verfied_email - Whether the email is verified
 * @property {string} name - Full name
 * @property {string} given_name - First name
 * @property {string} family_name - Last name
 * @property {string} picture - Profile picture URL
 */
export interface OAuthUserInfo {
    id: string;
    email: string;
    verfied_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
}

/**
 * Represents a system user.
 *
 * @property {string} [id] - Unique ID of the user
 * @property {string} name - Display name
 * @property {string} email - Email address
 * @property {string} password - Hashed password
 * @property {Date} [createdAt] - Timestamp when the user was created
 * @property {Date} [updatedAt] - Timestamp of last update
 * @property {string} [avatar] - URL or path to the user's avatar
 * @property {FriendRequest[]} [sentRequests] - Friend requests sent by the user
 * @property {FriendRequest[]} [receivedRequests] - Friend requests received by the user
 */
export default interface UserModel {
    id?: string;
    name: string;
    email: string;
    password: string;
    createdAt?: Date;
    updatedAt?: Date;
    avatar?: string;

    sentRequests?: FriendRequest[];
    receivedRequests?: FriendRequest[];

    secret?: string | null;
}

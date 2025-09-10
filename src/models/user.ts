import type FriendRequest from "./friend.js";



export type UserJWTPayload = {
    uid: string;
    createdAt: string;
};

export interface UserUpdateInput {
    field: string;
    value: string;
};

export interface UserLoginInput {
    email: string;
    password: string;
};

export interface UserRegisterInput {
    name: string;
    email: string;
    password: string;
};

export interface OAuthUserInfo {
    id: string;
    email: string;
    verfied_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
}

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
};


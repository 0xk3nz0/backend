export default interface UserModel {
    id?: string;
    name: string;
    email: string;
    password: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export interface UserRegisterInput {
    name: string;
    email: string;
    password: string;
};

export interface UserLoginInput {
    email: string;
    password: string;
};

export interface UserUpdateInput {
    field: string;
    value: string;
};

// UserProfileOutput {
//     id: string;
//     name: string;
//     avatar: string;
//     createdAt: Date;
// }

export type UserJWTPayload = {
    uid: string;
    name: string;
    createdAt: string;
};

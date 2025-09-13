import type UserService from "../services/user.ts";
import type FriendService from "../services/friend.js";
import type AuthService from "../services/auth.js";
import type TOTPService from "../services/totp.js";



export interface ServiceManager {
    user: UserService;
    friend: FriendService;
    auth: AuthService;
    totp: TOTPService;
}

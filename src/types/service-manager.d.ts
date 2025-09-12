import type UserService from "../services/user.ts";
import type FriendService from "../services/friend.js";
import type AuthService from "../services/auth.js";



export interface ServiceManager {
    user: UserService;
    friend: FriendService;
    auth: AuthService;
}

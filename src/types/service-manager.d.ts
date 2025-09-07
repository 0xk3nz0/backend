import type UserService from "../services/user.ts";
import type FriendService from "../services/friend.js";



export interface ServiceManager {
    user: UserService;
    friend: FriendService;
}

import type UserService from "../services/user.ts";



export interface ServiceManager {
    user: UserService;
}

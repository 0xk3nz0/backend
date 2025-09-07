import { describe, it, beforeEach, expect } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import { PrismaClient } from "../generated/prisma/index.js";
import UserService from "../services/user.js";
import FriendService from "../services/friend.js";



const prisma = new PrismaClient();

describe("FriendService", () => {
    let fastify: FastifyInstance;
    let userService: UserService;
    let friendService: FriendService;
    let user1: any, user2: any;

    beforeEach(async () => {
        // Reset DB before each test
        await prisma.friendRequest.deleteMany();
        await prisma.user.deleteMany();

        fastify = Fastify();
        userService = new UserService(fastify);
        friendService = new FriendService(fastify);

        // Create 2 users
        user1 = await prisma.user.create({
            data: { id: "u1", name: "User One", email: "one@test.com", password: "123" }
        });

        user2 = await prisma.user.create({
            data: { id: "u2", name: "User Two", email: "two@test.com", password: "123" }
        });
    });

    it("should send a friend request", async () => {
        const request = await friendService.sendRequest(user1.id, user2.id);

        if (request !== undefined) {
            expect(request.requesterId).toBe(user2.id);
            expect(request.requestedId).toBe(user1.id);
            expect(request.status).toBe("PENDING");
        }
    });

    it("should accept a friend request", async () => {
        const request = await friendService.sendRequest(user1.id, user2.id);

        if (request !== undefined) {
            if (request.id) {
                await friendService.acceptRequest(request.id);
                const updated = await prisma.friendRequest.findUnique({ where: { id: request.id } });

                expect(updated?.status).toBe("ACCEPTED");
            } else {
                throw new Error("request id undefined!");
            }
        }
    });

    it("should decline a friend request", async () => {
        const request = await friendService.sendRequest(user1.id, user2.id);

        if (request !== undefined) {
            if (request.id) {
                await friendService.declineRequest(request.id);
                const updated = await prisma.friendRequest.findUnique({where: {id: request.id}});

                expect(updated?.status).toBe("REJECTED");
            } else {
                throw new Error("request id undefined!");
            }
        }
    });

    it("should return accepted friends", async () => {
         const request = await friendService.sendRequest(user1.id, user2.id);

         if (request !== undefined) {
             if (request.id) {
                 await friendService.acceptRequest(request.id);

                 const friends = await friendService.getFriends(user2.id);
                 expect(friends).toContain(user1.id);
             } else {
                 throw new Error("request id undefined!");
             }
         }
    });

    it("should return pending requests", async () => {
        await friendService.sendRequest(user1.id, user2.id);
        const pending = await friendService.getPendingRequests(user2.id);

        if (pending !== undefined) {
            if (pending) {
                expect(pending.length).toBe(1);
                expect(pending[0]?.status).toBe("PENDING");
            } else {
                throw new Error("pending requests object is undefined!");
            }
        }
    });
});

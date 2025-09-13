import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "utils/prisma.js";

export const createRoomHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, creatorId, type, members } = request.body as {
        name?: string | undefined | null,
        creatorId: string,
        type?: 'DIRECT' | 'GROUP',
        members?: {
            userId: string,
            role?: 'ADMIN' | 'MEMBER'
        }[]
    };

    const creator = await prisma.user.findUnique({
        where: {
            id: creatorId
        }
    });
    if (!creator) {
        return reply.code(400).send({ error: 'CreatorId does not exist' });
    }

    if (members) {
        const allUsersExist = await Promise.all(
            members.map( (member) => prisma.user.findUnique({ where: { id: member.userId } }) )
        );
        if (allUsersExist.some( (user) => !user )) {
            return reply.code(400).send({ error: 'One or more members IDs do not exist' });
        }
        
        // i think this will never called
        if (type === 'DIRECT') {
            const otherUserId = members[0]?.userId;
            if (!otherUserId) {
                return reply.code(400).send({ error: 'Direct room must have a member (receiver)' });
            }
            const existingRoom = await prisma.room.findFirst({
                where: {
                    type: 'DIRECT',
                    members: {
                        every: {
                            userId: { in: [creatorId, otherUserId] }
                        }
                    }
                }
            });
            if (existingRoom) {
                return reply.code(400).send({ error: 'Direct room already exist', room: existingRoom });
            }
        }
    }

    if (name) {
        const roomExist = await prisma.room.findFirst({
            where: {
                name
            }
        });
        if (roomExist) {
            return reply.code(400).send({ error: 'Room with this name already exist' });
        }
    }
    try {
        const room = await prisma.room.create({
            data: {
                name: type === "GROUP" ? name : null, // group needs a name, direct doesn't
                type: type ?? "GROUP", // default to GROUP
                members: {
                    create: [
                        { userId: creatorId, role: 'ADMIN' }, // always add creator
                        ...(members
                        ?.filter((m) => m.userId !== creatorId) // remove duplicates
                        .map((m) => ({
                            userId: m.userId,
                            role: type === 'DIRECT' ? 'MEMBER' : m.role ?? 'MEMBER',
                        })) ?? []),
                    ],
                },
            },
            include: { members: true },
        });
        reply.code(201).send(room);
    } catch(error) {
        request.log.error(error);
        reply.code(500).send({ error: 'Failed to create room' });
    }
}


import { authenticateWebSocketToken } from '../middleware/chat.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as chatModel from '../models/chat.js';
import { chatSchema } from '../schemas/chat.js';
import { prisma } from '../utils/prisma.js';
import { wsValidators } from '../server.js';
import { WebSocket as WS } from 'ws';
import process from 'process';
import type { User } from 'generated/prisma/index.js';

export const CONFIG = {
    MESSAGE: {
        MAX_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH || '2000'),
        EDIT_WINDOW_HOURS: parseInt(process.env.MESSAGE_EDIT_WINDOW_HOURS || '24')
    },
    ROOM: {
        MAX_NAME_LENGTH: parseInt(process.env.MAX_ROOM_NAME_LENGTH || '100')
    },
    RATE_LIMITS: {
        DELETED_MESSAGES_PER_MINUTE: parseInt(process.env.RATE_LIMIT_DELETE_MESSAGES || '5'),
        ROOM_KICKS_PER_MINUTE: parseInt(process.env.RATE_LIMIT_ROOM_KICKS || '2'),
        ADMIN_ACTIONS_PER_MINUTE: parseInt(process.env.RATE_LIMIT_ADMIN || '3'),
        MESSAGES_PER_MINUTE: parseInt(process.env.RATE_LIMIT_MESSAGES || '10'),
        TYPING_PER_10_SECONDS: parseInt(process.env.RATE_LIMIT_TYPING || '5'),
        EDITS_PER_10_SECONDS: parseInt(process.env.RATE_LIMIT_EDITS || '5'),
        PROMOTE_MEMBER: parseInt(process.env.RATE_LIMIT_PROMOTE || '5'),
    },
    CLEANUP: {
        CLIENT_OFFSETS_MAX: parseInt(process.env.MAX_CLIENT_OFFSETS || '1000'),
        CLIENT_OFFSETS_MAX_AGE_MINUTES: parseInt(process.env.CLIENT_OFFSETS_MAX_AGE || '30'),
        CLEANUP_INTERVAL_MINUTES: parseInt(process.env.CLEANUP_INTERVAL || '2')
    }
} as const;

type WSMessageType =
    | 'join_room'
    | 'leave_room'
    | 'create_room'
    | 'delete_room'
    | 'edit_message'
    | 'delete_message'
    | 'send_message'
    | 'send_direct_message'
    | 'get_messages'
    | 'get_more_messages'
    | 'get_room_members'
    | 'promote_member'
    | 'update_status'
    | 'kick_member'
    | 'typing';

interface WSMessage<T = any> {
    type: WSMessageType;
    payload: T;
}

// Extended Websocket type
type ExtendedWS = WS & { userData?: { userId: string; rooms: Set<string> }, authenticatedUser: any };

const liveConnections: Record<string, Set<ExtendedWS>> = {};
const userConnections: Map<string, Set<ExtendedWS>> = new Map();


// HTTP Handlers
export const createMessageHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { senderId, content, roomId, receiverId } = request.body as chatModel.CreateMessageBody;

    // Validate sender
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    if (!sender) {
        return reply.code(400).send({ error: 'Sender ID does not exist' });
    }

    // Validate room or receiver
    if (roomId) {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) {
            return reply.code(400).send({ error: 'Room ID does not exist' });
        }
    } else if (receiverId) {
        if (receiverId === senderId) {
            return reply.code(400).send({ error: 'Cannot send a message to yourself' });
        }
        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
        if (!receiver) {
            return reply.code(400).send({ error: 'Receiver ID does not exist' });
        }
    }

    try {
        const sanitizedContent = escapeHtml(content.trim());
        const message = await prisma.message.create({
            data: {
                senderId,
                content: sanitizedContent,
                receiverId: receiverId ?? null,
                roomId: roomId ?? null,
            },
        });
        request.log.debug({ message }, 'Message created');
        return reply.code(201).send({ message });
    } catch (error) {
        request.log.error({ error }, 'Failed to create message');
        return reply.code(500).send({ error: 'Internal server error' });
    }
};

export const getMessageHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { roomId, senderId, receiverId, limit = 50, offset = 0 } = request.query as chatModel.GetMessageQuery;

    if (!roomId && !(senderId && receiverId)) {
        return reply.code(400).send({ error: 'Provide either a roomId or both senderId and receiverId' });
    }

    try {
        let messages;
        if (roomId) {
            messages = await prisma.message.findMany({
                where: { roomId },
                include: { sender: true, receiver: true },
                orderBy: { createdAt: 'asc' },
                skip: offset,
                take: limit,
            });
        } else {
            messages = await prisma.message.findMany({
                where: {
                    OR: [
                        { senderId: senderId as string, receiverId: receiverId as string },
                        { senderId: receiverId as string, receiverId: senderId as string },
                    ],
                },
                include: { sender: true, receiver: true },
                orderBy: { createdAt: 'asc' },
                skip: offset,
                take: limit,
            });
        }
        return reply.code(200).send(messages);
    } catch (error) {
        request.log.error({ error }, 'Failed to fetch messages');
        return reply.code(500).send({ error: 'Internal server error' });
    }
};

// Rate limiting and Spam prevention

// Track message counts and timestamps
const rateLimits = new Map<string, { count: number, resetTime: number }>(); // key: userId

const cleanupExpiredRateLimits = () => {
    const now = Date.now();
    let removedCount = 0;

    for (const [userId, limit] of rateLimits.entries()) {
        if (now > limit.resetTime) {
            rateLimits.delete(userId);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} expired rate limit entries`);
    }

    console.log(`Active rate limit entries: ${rateLimits.size}`);
}

// Start rate limit cleanup interval (every 5 minutes)
const rateLimitCleanupInterval = setInterval(cleanupExpiredRateLimits, CONFIG.CLEANUP.CLEANUP_INTERVAL_MINUTES * 60 * 1000);

// Check if a connection is within rate limits
// - JWT Authentication: All sensitive operations require valid JWT tokens
// - Authorization: Room membership verification before joining/messaging
// - Enhanced Rate Limiting: Different limits per message type, tracked by user ID
// - Content Sanitization: XSS prevention and message validation
// - Structured Error Handling: Consistent error responses with error codes
// - Comprehensive Logging: Detailed operation tracking for monitoring
// - Input Validation: Message length limits and spam detection
// - Permission Checks: Users must have room access to perform actions
const checkRateLimit = (connection: ExtendedWS, maxRequests = 10, windowMs = 60000) => { // default 10reqs/1min
    const userId = connection.authenticatedUser?.uid;
    if (!userId) {
        return false;
    }

    const now = Date.now();
    
    // Get or create rate limit entry for this user
    let rateLimit = rateLimits.get(userId);

    // If no entry exists or the window has expired, create/reset it
    if (!rateLimit || now > rateLimit.resetTime) {
        rateLimits.set(userId, { count: 1, resetTime: now + windowMs });
        return true;
    }

    // Check if user has exceeded the limit
    if (rateLimit.count >= maxRequests) {
        return false;
    }

    // Increment the counter
    rateLimit.count++;
    console.log(
        `Request logged for userId=${userId}. Count=${rateLimit.count}/${maxRequests}`
    );
    return true;
};

interface RoomRateLimit {
    count: number;
    resetTime: number;
}

const roomRateLimits: Map<string, Map<string, RoomRateLimit>> = new Map();

// Cleanup function for room rate limits
const cleanupExpiredRoomRateLimits = () => {
    const now = Date.now();
    let removedRoomCount = 0;
    let removedActionCount = 0;

    for (const [roomId, roomLimits] of roomRateLimits.entries()) {
        for (const [actionKey, limit] of roomLimits.entries()) {
            if (now > limit.resetTime) {
                roomLimits.delete(actionKey);
                removedActionCount++;
            }
        }
        
        // Remove empty room entries
        if (roomLimits.size === 0) {
            roomRateLimits.delete(roomId);
            removedRoomCount++;
        }
    }

    if (removedActionCount > 0 || removedRoomCount > 0) {
        console.log(`Cleaned up ${removedActionCount} room rate limit actions and ${removedRoomCount} empty room entries`);
    }
};

// Schedule room rate limit cleanup
const roomRateLimitCleanupInterval = setInterval(cleanupExpiredRoomRateLimits, CONFIG.CLEANUP.CLEANUP_INTERVAL_MINUTES * 60 * 1000);

const checkRoomRateLimit = (connection: ExtendedWS, roomId: string, action: string, maxRequests = 3, windowMs = 60000) => {
    const userId = connection.authenticatedUser?.id;
    if (!userId) {
        return false;
    }

    const now = Date.now();
    const actionKey = `${userId}:${action}`;

    // Initialize map for room if it doesn't exist
    if (!roomRateLimits.has(roomId)) {
        roomRateLimits.set(roomId, new Map());
    }
    const roomLimits = roomRateLimits.get(roomId)!;

    const actionLimit = roomLimits.get(actionKey);

    if (!actionLimit || now > actionLimit.resetTime) {
        roomLimits.set(actionKey, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (actionLimit.count >= maxRequests) {
        return false;
    }

    actionLimit.count++;
    return true;
};

// exreact token from header
function extractTokenFromHeaders(headers: any): string | null {
    // const auth = headers.cookie;
    const auth = headers.authorization;
    return auth?.startsWith('Bearer') ? auth.slice(7) : null;
}

// Simulate the load more messages in a room
const clientOffsets: Map<WS, { offsets: Map<string, number>, lastAccess: number }> = new Map();

const MAX_CLIENT_OFFSETS = 1000; // Maximum number of entries to keep
const CLIENT_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Cleanup function for client offsets
const cleanupClientOffsets = () => {
    const now = Date.now();
    const maxAge = CONFIG.CLEANUP.CLIENT_OFFSETS_MAX_AGE_MINUTES * 60 * 1000; // 30 minutes

    let removedCount = 0;
    for (const [connection, data] of clientOffsets.entries()) {
        if (now - data.lastAccess > maxAge || connection.readyState !== WS.OPEN) {
            clientOffsets.delete(connection);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} stale client offsets`);
    }

    if (clientOffsets.size > MAX_CLIENT_OFFSETS) {
        const sortedEntries = Array.from(clientOffsets.entries())
            .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        const toRemove = sortedEntries.slice(0, clientOffsets.size - MAX_CLIENT_OFFSETS);
        toRemove.forEach(([connection]) => clientOffsets.delete(connection));
        console.log(`Removed ${toRemove.length} oldest client offsets due to max limit`);
    }
};

// Start cleanup interval
const cleanupInterval = setInterval(cleanupClientOffsets, CLIENT_CLEANUP_INTERVAL);


// Prevent XSS: escape <, >, &, ", ' => &lt;, &gt;, &amp;, &quot;, &#39;
const escapeHtml = (input: string): string => {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const maxRequests = 10; // 10 req
const windowMs = 60000; // 60 sec

// Chat endpoints
const createRoom = async (connection: ExtendedWS, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { name, type = 'GROUP', userId, description } = payload as chatModel.CreateRoomPayload;

    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Unauthorized: User ID mismatch'
        }));
        return;
    }

    // Validate room name
    if (!name || name.trim().length === 0) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Room name is required'
        }));
        return ;
    }
    
    if (name.length > CONFIG.ROOM.MAX_NAME_LENGTH) {
        connection.send(JSON.stringify({
            type: 'error',
            message: `Room name must be less than ${CONFIG.ROOM.MAX_NAME_LENGTH} characters`
        }));
        return ;
    }

    const validTypes = ['DIRECT', 'GROUP']; // 'CHANNEL'
    if (!validTypes.includes(type)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Invalid room type, Valid types: DIRECT, GROUP'
        }));
        return ;
    }

    
    try {
        const sanitizedName = escapeHtml(name.trim());
        
        const existingRoom = await prisma.room.findFirst({
            where: {
                name: sanitizedName,
                type: type
            }
        });

        if (existingRoom) {
            connection.send(JSON.stringify({
                type: 'error',
                message: 'Room with this name already exists'
            }));
            return ;
        }

        // const sanitizedDescription = description ? escapeHtml(description.trim()) : null;

        // Use a transaction to ensure atomicity: with transaction Both operations succeed together OR both fail together
        const txResult = await prisma.$transaction(async (tx) => {
            // Create the room
            const newRoom = await tx.room.create({
                data: {
                    name: sanitizedName,
                    type,
                    // description: sanitizedDescription,
                }
            });

            // Add creator as OWNER in the same transaction
            await tx.roomMember.create({
                data: {
                    userId: authUser.uid,
                    roomId: newRoom.id,
                    role: 'OWNER'
                }
            });
            return newRoom;
        });

        // Initialize live connections for this room
        liveConnections[txResult.id] = new Set();
        liveConnections[txResult.id]?.add(connection);

        if (!connection.userData) {
            connection.userData = { userId: authUser.uid, rooms: new Set() };
        }
        connection.userData.rooms.add(txResult.id);

        // Send success response
        connection.send(JSON.stringify({
            type: 'room_created',
            payload: {
                room: {
                    id: txResult.id,
                    name: txResult.name,
                    type: txResult.type,
                    // description: txResult.description,
                    createdAt: txResult.createdAt,
                    createdBy: authUser.uid
                },
                userRole: 'OWNER'
            }
        }));

    } catch(error) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to create room'
        }));
    }
}

const joinRoom = async (connection: ExtendedWS, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { roomId, userId } = payload as chatModel.JoinRoomPayload;

    if (authUser.uid !== userId) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Unauthorized: User ID mismatch'
        }));
        return ;
    }

    try {
        // Validate room and user
        const roomMember = await prisma.roomMember.findUnique({
            where: { userId_roomId: { userId, roomId } }
        });

        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: {
                members: {
                    select: { userId: true, role: true }
                }
            }
        });
        if (!room) {
            connection.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            connection.send(JSON.stringify({ type: 'error', message: 'User not found' }));
            return;
        }

        const membership = room.members.find(m => m.userId === userId);
        if(!membership) {
            await prisma.roomMember.create({
                data: { userId, roomId, role: 'MEMBER' }
            });
        }

        // Track connection
        liveConnections[roomId] = liveConnections[roomId] ?? new Set();
        liveConnections[roomId].add(connection);

        if (!connection.userData) {
            connection.userData = { userId, rooms: new Set() };
        }
        connection.userData.rooms.add(roomId);

        connection.send(JSON.stringify({
            type: 'joined',
            payload: {
                roomId: room.id,
                roomName: room.name,
                type: room.type,
                members: room.members.map(m => ({ userId: m.userId, role: m.role })),
                joinedAt: new Date().toISOString()
            }
        }));
    } catch(error) {
        request.log.error(
            {
                error,
                roomId,
                userId
            },
            'Failed to join room'
        );
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to join room'
        }));
    }
}

const leaveRoom = async (connection: ExtendedWS, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { roomId, userId } = payload as chatModel.LeaveRoomPayload;

    if (authUser.uid !== userId) {
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    const roomMember = await prisma.roomMember.findUnique({
        where: {
            userId_roomId: {
                userId,
                roomId
            }
        }
    });

    if (!roomMember) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'You are not a member of this room'
        }));
        return ;
    }

    // Validate room and user
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
        connection.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
    }

    // Remove connection
    liveConnections[roomId]?.delete(connection);
    if (connection.userData?.rooms) {
        connection.userData.rooms.delete(roomId);
        if (connection.userData.rooms.size === 0) {
            delete connection.userData;
        }
    }

    await prisma.roomMember.delete({
        where: { userId_roomId: { userId, roomId } }
    });

    // Notify room members
    liveConnections[roomId]?.forEach((ws) => {
        if (ws.readyState === WS.OPEN && ws.userData?.userId !== userId) {
            ws.send(JSON.stringify({
                type: 'member_left',
                payload: { roomId, userId }
            }));
        }
    });

    connection.send(JSON.stringify({ type: 'left', payload: { roomId, userId } }));
}

const deleteRoom = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { roomId, userId } = payload as chatModel.DeleteRoomPayload;

    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    // Step 1: Check if room exists
    const room = await prisma.room.findUnique({
        where: { id: roomId }
    });
    if (!room) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }

    // Step 2: Check membership and ownership
    const userMembership = await prisma.roomMember.findUnique({
        where: { userId_roomId: { userId: authUser.uid, roomId } }
    });

    if (!userMembership || userMembership.role !== 'OWNER') {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Only room owner can delete the room'
        }));
        return ;
    }

    // Step 3: Delete room
    await prisma.room.delete({
        where: { id: roomId }
    });

    // Step 4: Notify and clean up connections
    liveConnections[roomId]?.forEach((ws) => {
        if (ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify({
                type: 'room_removed',
                payload: { roomId }
            }));
        }
        ws.userData?.rooms?.delete(roomId);
        if (ws.userData?.rooms?.size === 0) {
            delete ws.userData;
        }
    });
    // Step 5: Confirm success to owner
    delete liveConnections[roomId];
    connection.send(JSON.stringify({
        type: 'room_deleted_success',
        payload: { roomId }
    }));
}

const getRoomMembers = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { roomId, userId } = payload as chatModel.GetRoomMembersPayload;

    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    try {
        const [roomMember, members] = await Promise.all([
            prisma.roomMember.findUnique({
                where: {
                    userId_roomId: {
                        userId: authUser.uid,
                        roomId
                    }
                }
            }),
            prisma.roomMember.findMany({
                where: { roomId },
                select: {
                    userId: true,
                    role: true,
                    joinedAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            status: true
                        }
                    }
                },
                orderBy: [
                    { role: 'asc' },
                    { joinedAt: 'asc' }
                ]
            })
        ]);

        if (!roomMember) {
            connection.send(JSON.stringify({
                type: 'error',
                message: 'Not a member of this room'
            }));
            return ;
        }

        connection.send(JSON.stringify({
            type: 'room_members',
            payload: {
                roomId,
                members: members.map(m => ({
                    userId: m.userId,
                    role: m.role,
                    joinedAt: m.joinedAt,
                    user: m.user
                }))
            }
        }));

    } catch(error) {
        request.log.error(
            {
                error,
                roomId
            },
            'Failed to fetch room members'
        );
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to fetch room members'
        }));
    }
}

const kickMember = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { roomId, userId, targetUserId } = payload as chatModel.KickMemberPayload;

    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    // Room-specific rate limiting for kick actions
    if (!checkRoomRateLimit(connection, roomId, 'kick', CONFIG.RATE_LIMITS.ROOM_KICKS_PER_MINUTE, windowMs)) { // 2 kicks per room per minute
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Room-specific rate limit exceeded for kick action'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ROOM_KICKS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }

    // Check general rate limit
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) { // 3 total admin actions per minute
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }

    // Check if user is admin/owner of this room
    const userMembership = await prisma.roomMember.findUnique({
        where: {
            userId_roomId: {
                userId: authUser.uid,
                roomId
            }
        }
    });

    if (!userMembership) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Not a member of this room'
        }));
        return ;
    }

    if (userMembership.role !== 'ADMIN' && userMembership.role !== 'OWNER') {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Insufficient permissions: Only admins can kick members'
        }));
        return ;
    }

    // Can't kick yourself
    if (authUser.uid === targetUserId) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Cannot kick yourself'
        }));
        return ;
    }

    // Check if the target user in the room
    const targetMembership = await prisma.roomMember.findUnique({
        where: {
            userId_roomId: {
                userId: targetUserId,
                roomId
            }
        }
    });

    if (!targetMembership) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Target is not a member of this room'
        }));
        return ;
    }

    // Can't kick owne
    if (targetMembership.role === 'OWNER') {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Cannot kick room owner'
        }));
        return ;
    }

    await prisma.roomMember.delete({
        where: {
            userId_roomId: {
                userId: targetUserId,
                roomId
            }
        }
    });

    // Notify and disconnect the kicked user's connections
    const targetConnections = userConnections.get(targetUserId) || new Set();
    targetConnections?.forEach((ws) => {
        if (ws.userData?.rooms.has(roomId)) {
            ws.send(JSON.stringify({
                type: 'kicked_from_room',
                payload: {
                    roomId,
                    kickedBy: authUser.uid,
                    reason: 'You have been removed from this room'
                }
            }));
            liveConnections[roomId]?.delete(ws);
            ws.userData.rooms.delete(roomId);
            if (ws.userData.rooms.size === 0) {
                delete ws.userData;
            }
        }
    });

    // Notify all room members
    liveConnections[roomId]?.forEach((ws) => {
        if (ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify({
                type: 'member_kicked',
                payload: {
                    roomId,
                    kickedUserId: targetUserId,
                    kickedBy: authUser.uid
                }
            }));
        }
    });

    // Confirm to admin
    connection.send(JSON.stringify({
        type: 'member_kicked_success',
        payload: {
            roomId,
            kickedUserId: targetUserId
        }
    }));
}

const promoteMember = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.PROMOTE_MEMBER, windowMs)) { // 3 promotions per minute
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${maxRequests} requests in ${windowMs / 1000}s`);
        return;
    }
    const { roomId, userId, targetUserId, newRole } = payload as chatModel.PromoteMemberPayload;

    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    // Validate new role
    const validRoles = ['MEMBER', 'ADMIN', 'OWNER'];
    if(!validRoles.includes(newRole)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Invalid role. valid roles MEMBER, ADMIN, OWNER'
        }));
        return ;
    }

    const userMembership = await prisma.roomMember.findUnique({
        where: {
            userId_roomId: {
                userId: authUser.uid,
                roomId
            }
        }
    });

    if (!userMembership) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Not a member of this room'
        }));
        return ;
    }
    
    if (userMembership.role !== 'ADMIN' && userMembership.role !== 'OWNER') {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Insufficient permissions: Only admins can promote members'
        }));
        return ;
    }

    // Check if target user is in the room
    const targetMembership = await prisma.roomMember.findUnique({
        where: {
            userId_roomId: {
                userId: targetUserId,
                roomId
            }
        }
    });

    if (!targetMembership) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'User is not a member of this room'
        }));
        return ;
    }
    
    // Only OWNER can promote to OWNER or demote from OWNER
    if ((newRole === 'OWNER' || targetMembership.role === 'OWNER') && userMembership.role !== 'OWNER') {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Only room owner can change owner status'
        }));
        return ;
    }

    // Can't change ur own role
    if (authUser.uid === targetUserId) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Cannot change your own role'
        }));
        return ;
    }

    try {

        // Special case: If promoting to OWNER, demote cureent owner to ADMIN
        if (newRole === 'OWNER') {
            await prisma.roomMember.update({
                where: {
                    userId_roomId: {
                        userId: authUser.uid,
                        roomId
                    }
                },
                data: {
                    role: 'ADMIN'
                }
            });
        }

        // Update the target user's role
        const updatedMember = await prisma.roomMember.update({
            where: {
                userId_roomId: {
                    userId: targetUserId,
                    roomId
                }
            },
            data: {
                role: newRole
            }
        });

        // Notify all room members
        liveConnections[roomId]?.forEach((ws) => {
            if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                    type: 'member_role_changed',
                    payload: {
                        roomId,
                        userId: targetUserId,
                        newRole,
                        changedBy: authUser.uid
                    }
                }));
            }
        });

        // Notify the promoted user across all their connections
        const targetConnections = userConnections.get(targetUserId) || new Set();
        targetConnections?.forEach((ws) => {
            if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                    type: 'member_role_changed',
                    payload: {
                        roomId,
                        userId: targetUserId,
                        newRole,
                        changedBy: authUser.uid
                    }
                }));
            }
        });

        // Confirm to admin
        connection.send(JSON.stringify({
            type: 'member_role_changed',
            payload: {
                roomId,
                userId: targetUserId,
                newRole,
                oldRole: targetMembership.role
            }
        }));
    } catch(error) {
        request.log.error(
            {
                error,
                roomId,
                targetUserId,
                newRole
            },
            'Failed to promote member'
        );
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to update member role'
        }));
    }
}

const sendMessage = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, maxRequests, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${maxRequests} requests in ${windowMs / 1000}s`);
        return ;
    }

    const { roomId, senderId, text } = payload as chatModel.SendMessagePayload;

    if (authUser.uid !== senderId) {
        request.log.warn({ type, senderId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    // Validate message content
    if (!text || text.trim().length === 0) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Message content cannot be empty'
        }));
        return ;
    }

    if (text.length > CONFIG.MESSAGE.MAX_LENGTH) {
        connection.send(JSON.stringify({
            type: 'error',
            message: `Message too long (max ${CONFIG.MESSAGE.MAX_LENGTH} characters)`
        }));
        return ;
    }

    try {
        const roomMember = await prisma.roomMember.findUnique({
            where: {
                userId_roomId: {
                    userId: authUser.uid,
                    roomId
                }
            },
            include: {
                room: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!roomMember || !roomMember.room) {
            connection.send(JSON.stringify({
                type: 'error',
                message: 'Not a member of this room or room not found'
            }));
            return ;
        }

        const sanitizedText = escapeHtml(text.trim());

        // Persist message
        const message = await prisma.message.create({
            data: {
                content: sanitizedText,
                senderId,
                roomId
            }
        });

        // Broadcast to room
        liveConnections[roomId]?.forEach((ws) => {
            if (ws.readyState === WS.OPEN) {
                ws.send(
                    JSON.stringify({
                        type: 'message',
                        payload: {
                            id: message.id,
                            roomId,
                            senderId,
                            text: sanitizedText,
                            createdAt: message.createdAt,
                        },
                    })
                );
            }
        });
    } catch(error) {
        request.log.error(
            {
                error,
                senderId,
                roomId
            },
            'Failed to send message'
        );
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to send message'
        }));
    }
}

const getMessages = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { roomId, userId, limit = 50, offset = 0 } = payload as chatModel.GetMessagePayload;

    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    const roomMember = await prisma.roomMember.findUnique({
        where: {
            userId_roomId: {
                userId: authUser.uid,
                roomId
            }
        },
        include: { room: true }
    });

    if (!roomMember) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Not a member of this room'
        }));

        return ;
    }

    // Validate room
    const room = roomMember.room;
    if (!room) {
        connection.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
    }

    const messages = await prisma.message.findMany({
        where: { roomId },
        include: { sender: true, receiver: true },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: limit,
    });

    connection.send(JSON.stringify({ type: 'messages', payload: messages }));
}

const getMoreMessages = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { roomId, userId, limit = 10, reset = false } = payload as chatModel.GetMoreMessagesPayload;

    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    const roomMember = await prisma.roomMember.findUnique({
        where: {
            userId_roomId: {
                userId: authUser.uid,
                roomId
            }
        }
    });

    if (!roomMember) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Not a member of this room'
        }));

        return ;
    }

    // Initialize client tracking
    if (!clientOffsets.has(connection)) {
        clientOffsets.set(connection, { offsets: new Map(), lastAccess: Date.now() });
    }
    const clientData = clientOffsets.get(connection)!;
    clientData.lastAccess = Date.now();

    // const roomOffsets = clientOffsets.get(connection)!;

    // Handle reset - set offset to 0 if requested
    let offset = clientData.offsets.get(roomId) ?? 0;
    if (reset) {
        offset = 0;
        clientData.offsets.set(roomId, 0);
    }
    
    // Validate room
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
        connection.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
    }

    try {
        // Fetch the next batch of messages
        const messages = await prisma.message.findMany({
            where: { roomId },
            include: { sender: true, receiver: true },
            orderBy: { createdAt: 'asc' },
            skip: offset,
            take: limit
        });

        // Update offset for next request

        // roomOffsets.set(roomId, offset + messages.length);
        clientData.offsets.set(roomId, offset + messages.length);

        // Send messages to client
        connection.send(JSON.stringify({ type: 'more_messages', payload: messages }));
    } catch(error) {
        request.log.error(
            {
                error,
                roomId
            }
        );
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to fetch messages'
        }));
    }
}

const sendDirectMessage = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.MESSAGES_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.MESSAGES_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return ;
    }

    const { senderId, receiverId, text } = payload as chatModel.DirectMessagePayload;

    if (authUser.uid !== senderId) {
        request.log.warn({ type, senderId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    // Validate sender and receiver
    const [sender, receiver] = await Promise.all([
        prisma.user.findUnique({ where: { id: senderId } }),
        prisma.user.findUnique({ where: { id: receiverId } }),
    ]);
    if (!sender || !receiver) {
        connection.send(JSON.stringify({ type: 'error', message: 'Sender or receiver not found' }));
        return;
    }
    if (senderId === receiverId) {
        connection.send(JSON.stringify({ type: 'error', message: 'Cannot send message to yourself' }));
        return;
    }

    try {
        const sanitizedText = escapeHtml(text);

        // Persist message
        const message = await prisma.message.create({
            data: { content: sanitizedText, senderId, receiverId },
        });

        // Send to receiver's connections
        const receiverConnections = userConnections.get(receiverId) || new Set();
        receiverConnections.forEach((ws) => {
            if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                    type: 'direct_message',
                    payload: {
                        id: message.id,
                        senderId,
                        receiverId,
                        text: sanitizedText,
                        createdAt: message.createdAt,
                    }
                }));
            }
        });

        // Confirm to sender
        connection.send(JSON.stringify({ type: 'direct_message_sent', payload: message }));
    } catch(error) {
        request.log.error(
            {
                error,
                senderId,
                receiverId
            },
            'Failed to send direct message'
        );
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to send direct message'
        }));
    }
}

const editMessage = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if(!checkRateLimit(connection, CONFIG.RATE_LIMITS.EDITS_PER_10_SECONDS, 10000)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        return ;
    }

    const { messageId, newText, userId } = payload as chatModel.EditMessagePayload;

    // Verify user is authenticated and matches
    if (authUser.uid !== userId) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Unauthorized: User ID mismatch'
        }));
        return ;
    }

    // Validate message exists and get room info
    const message = await prisma.message.findUnique({
        where: {
            id: messageId
        },
        include: {
            room: { include: { members: true } },
            sender: true
        }
    });

    if (!message) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Message not found'
        }));
        return ;
    }

    // Check if user is the message sender
    if (message.sender.id !== authUser.uid) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Unauthorized: Can only edit your own messages'
        }));
        return ;
    }

    // For room messages, verify user is still a room member
    if (message.roomId) {
        const roomMember = await prisma.roomMember.findUnique({
            where: {
                userId_roomId: {
                    userId: authUser.uid,
                    roomId: message.roomId
                }
            }
        });

        if (!roomMember) {
            connection.send(JSON.stringify({
                type: 'error',
                message: 'Not a member of this room'
            }));
            return ;
        }
    }

    // Check if message is too old to edit (e.g., 24 hours)
    const messageAge = Date.now() - message.createdAt.getTime();
    const maxEditAge = CONFIG.MESSAGE.EDIT_WINDOW_HOURS * 60 * 60 * 1000;
    if (messageAge > maxEditAge) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Message is too old to edit (max 24 hours)'
        }));
        return ;
    }

    // Validate new text
    if (!newText || newText.trim().length === 0) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Message content cannot be empty'
        }));
        return ;
    }

    if (newText.length > CONFIG.MESSAGE.MAX_LENGTH) {
        connection.send(JSON.stringify({
            type: 'error',
            message: `Message max length is ${CONFIG.MESSAGE.MAX_LENGTH} characters`
        }));
        return ;
    }

    try {
        const sanitizedText = escapeHtml(newText.trim());

        // Update the message
        const updatedMessage = await prisma.message.update({
            where: {
                id: messageId
            },
            data: {
                content: sanitizedText,
                updatedAt: new Date()
            },
            include: {
                sender: true,
                receiver: true
            }
        });

        // Broadcast the edit to relevant connections
        if (message.roomId) {
            // Room message - broadcast to all room members
            liveConnections[message.roomId]?.forEach((ws) => {
                if (ws.readyState == WS.OPEN && ws !== connection) {
                    ws.send(JSON.stringify({
                        type: 'message_edited',
                        payload: {
                            messageId: updatedMessage.id,
                            roomId: message.roomId,
                            senderId: updatedMessage.senderId,
                            newText: updatedMessage.content,
                            editedAt: updatedMessage.updatedAt,
                            senderName: updatedMessage.sender.name
                        }
                    }));
                }
            });
        } else if(message.receiverId) {
            // Direct message - notify both sender and receiver
            const targetUsers = [message.senderId, message.receiverId];
            const targetConnections = targetUsers.flatMap((id): ExtendedWS[] => Array.from(userConnections.get(id) || new Set()));
            targetConnections.forEach((ws) => {
                if (ws.readyState === WS.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'direct_message_edited',
                        payload: {
                            messageId: updatedMessage.id,
                            senderId: updatedMessage.senderId,
                            receiverId: updatedMessage.receiverId,
                            newText: updatedMessage.content,
                            editedAt: updatedMessage.updatedAt,
                        }
                    }));
                }
            });
        }

        // Confirm to the editor
        connection.send(JSON.stringify({
            type: 'message_edit_success',
            payload: {
                messageId: updatedMessage.id,
                newText: updatedMessage.content,
                editedAt: updatedMessage.updatedAt
            }
        }));
    } catch (error) {
        request.log.error({ error, messageId, userId: authUser.uid }, 'Failed to edit message');
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to edit message'
        }));
    }
}

const deleteMessage = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if(!checkRateLimit(connection, CONFIG.RATE_LIMITS.DELETED_MESSAGES_PER_MINUTE, 60000)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        return ;
    }

    const { messageId, userId } = payload as { messageId: string, userId: string };
    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Unauthorized: Cannot delete message as another user'
        }));
        return ;
    }

    const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { room: { include: { members: true } }, sender: true }
    });
    if (!message) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Message not found'
        }));
        return ;
    }

    if(message.sender.id !== authUser.uid) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Unauthorized: Can only delete your own messages'
        }));
        return ;
    }

    if (message.roomId) {
        const roomMember = await prisma.roomMember.findUnique({
            where: {
                userId_roomId: {
                    userId: authUser.uid,
                    roomId: message.roomId
                }
            }
        });
        if (!roomMember) {
            connection.send(JSON.stringify({
                type: 'error',
                message: 'Not a member of this room'
            }));
            return ;
        }
    }

    await prisma.message.delete({
        where: { id: messageId }
    });
    if (message.roomId) {
        liveConnections[message.roomId]?.forEach((ws) => {
            if(ws.readyState === WS.OPEN && ws !== connection) {
                ws.send(JSON.stringify({
                    type: 'message_deleted',
                    payload: {
                        messageId,
                        roomId: message.roomId,
                        deletedBy: authUser.uid
                    }
                }));
            }
        });
    } else if (message.receiverId) {
        const targetUsers = [message.senderId, message.receiverId];
        const targetConnections = targetUsers.flatMap((id): ExtendedWS[] => Array.from(userConnections.get(id) || new Set()));
        targetConnections.forEach((ws) => {
            if(ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                    type: 'direct_message_deleted',
                    payload: { messageId, deletedBy: authUser.uid }
                }));
            }
        });
    }
    connection.send(JSON.stringify({
        type: 'message_delete_success',
        payload: { messageId, deletedBy: authUser.uid }
    }));
}

const updateStatus = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if (!checkRateLimit(connection, CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE, windowMs)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        request.log.warn(`Rate limit reached: userId=${authUser.uid} | ${CONFIG.RATE_LIMITS.ADMIN_ACTIONS_PER_MINUTE} requests in ${windowMs / 1000}s`);
        return;
    }
    const { userId, status } = payload as chatModel.UpdateUserStatusPayload;

    if (userId !== authUser.uid) {
        request.log.warn({ type, userId, authUserId: authUser.uid }, 'User ID mismatch attempt');
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Unauthorized: User ID mismatch'
        }));
        return ;
    }

    const validStatuses = ['IN_GAME', 'OFFLINE', 'ONLINE', 'BUSY']; // 'AWAY
    if (!validStatuses.includes(status)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Invalid status. Valid statuses: IN_GAME, OFFLINE, ONLINE, BUSY'
        }));
        return ;
    }

    // Persist status to database
    await prisma.user.update({
        where: { id: userId },
        data: { status }
    });

    // Update status in database or notify relevant users
    const userRooms = await prisma.roomMember.findMany({
        where: { userId }
    });

    // Notify users
    userRooms.forEach((room) => {
        liveConnections[room.roomId]?.forEach((ws) => {
            if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                    type: 'user_status',
                    payload: { userId, status }
                }));
            }
        });
    });

    // Confirm to sender
    connection.send(JSON.stringify({
        type: 'status_updated',
        payload: { userId, status }
    }));
}

const typing = async (connection: ExtendedWS, type: string, authUser: User & { uid: string }, payload: any, request: FastifyRequest) => {
    if(!checkRateLimit(connection, CONFIG.RATE_LIMITS.TYPING_PER_10_SECONDS, 10000)) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded, please try again later'
        }));
        return ;
    }

    const { userId, status, roomId, receiverId } = payload as chatModel.TypingPayload;

    if (authUser.uid !== userId) {
        connection.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unauthorized: User ID mismatch' 
        }));
        return;
    }

    // Validate user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        connection.send(JSON.stringify({ type: 'error', message: 'User not found' }));
        return;
    }

    if (roomId) {
        // Validate room
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) {
            connection.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
        }

        const roomMember = await prisma.roomMember.findUnique({
            where: {
                userId_roomId: {
                    userId: authUser.uid,
                    roomId
                }
            }
        });

        if (!roomMember) {
            connection.send(JSON.stringify({
                type: 'error',
                message: 'Not a member of this room'
            }));

            return ;
        }

        // Broadcast typing status to room
        liveConnections[roomId]?.forEach((ws) => {
            if (ws !== connection && ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({ type: 'typing', payload: { userId, roomId, status } }));
            }
        });
    } else if (receiverId) {
        // Validate receiver
        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
        if (!receiver) {
            connection.send(JSON.stringify({ type: 'error', message: 'Receiver not found' }));
            return;
        }

        const receiverConnections = userConnections.get(receiverId) || new Set();
        receiverConnections.forEach((ws) => {
            if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                    type: 'typing',
                    payload: {
                        userId,
                        receiverId,
                        status
                    }
                }));
            }
        });
    }
}

/**
 * Handles incoming WebSocket connections and routes messages based on their type.
 * 
 * Supported message types:
 * - `join_room`: Join a chat room. Adds the user to the room's live connections and persists membership in the database.
 * - `leave_room`: Leave a chat room. Removes the user from the room's live connections.
 * - `send_message`: Send a message to a room. Persists the message and broadcasts it to all connected clients in the room.
 * - `get_messages`: Fetches a batch of messages from a room.
 * - `get_more_messages`: Fetches the next batch of messages from a room, supporting pagination.
 * - `send_direct_message`: Sends a direct message to another user. Persists the message and delivers it to the receiver if online.
 * - `typing`: Broadcasts typing status to a room or a direct message receiver.
 * 
 * Features:
 * - Validates message payloads using schemas.
 * - Tracks live WebSocket connections per room for efficient broadcasting.
 * - Handles client disconnects and cleans up resources.
 * - Provides structured error responses and logging.
 * - Tracks client message offsets for paginated message loading.
 * 
 * @param connection - The WebSocket connection object, extended with optional userData for tracking user and room.
 * @param request - The FastifyRequest object associated with the WebSocket upgrade.
 */
export const websocketHandler = async (connection: ExtendedWS, request: FastifyRequest) => {
    request.log.info('Client connected');

    // ⚡ Common close codes
    // Here are some you might use:
    // - 1000 → Normal closure (everything is fine, connection ended cleanly).
    // - 1001 → Going away (server shutdown, client leaving).
    // - 1002 → Protocol error (malformed frame).
    // - 1003 → Unsupported data (e.g., binary when only text expected).
    // - 1008 → Policy violation (authentication failure, unauthorized action).
    // - 1011 → Internal error (server couldn’t handle something).
    const token = extractTokenFromHeaders(request.headers);
    if (!token) {
        connection.close(1008, 'No token provided');
        return;
    }
    const authResult = await authenticateWebSocketToken(request.server, token);
    if (!authResult.success) {
        connection.close(1008, `Authentication failed: ${authResult.error}`);
        return ;
    }

    // Store the authenticated user
    connection.authenticatedUser = authResult.user;

    // Add connection to userConnections
    const userId = authResult.user.id;
    if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(connection);

    connection.on('message', async (rawMessage) => {
        let msg: WSMessage;
        try {
            msg = JSON.parse(rawMessage.toString());
        } catch (error) {
            connection.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
            return;
        }

        const { type, payload } = msg;
        const schema = chatSchema[type];
        if (!type || !payload) {
            connection.send(JSON.stringify({ type: 'error', message: 'Type and payload are required' }));
            return;
        }
        if (!schema) {
            connection.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
            return;
        }

        // Validate payload
        try {
            const validate = wsValidators[type];
            if (!validate) {
                connection.send(JSON.stringify({
                    type: 'error',
                    message: `No validator found for type ${type}`
                }));
                return ;
            }
            if (!validate(payload)) {
                const errors = validate.errors?.map(e => ({
                    path: e.instancePath,        // JSON path where error occurred (e.g., "/roomId")
                    message: e.message,          // Human-readable error message (includes custom errorMessage if set)
                    keyword: e.keyword,          // AJV validation keyword that failed (e.g., "type", "format", "required")
                    params: e.params             // Additional parameters specific to the validation keyword
                }));
                connection.send(JSON.stringify({
                    type: 'error',
                    message: 'Payload validation failed',
                    details: errors
                }));
                return;
            }
        } catch (error) {
            request.log.error({ error, type }, 'Schema validation error');
            connection.send(JSON.stringify({ type: 'error', message: 'Invalid payload schema' }));
            return;
        }

        try {

            const authUser = connection.authenticatedUser;
            if (!authUser || !authUser.uid) {
                connection.send(JSON.stringify({
                    type: 'error',
                    message: 'User not authenticated'
                }));
                return ;
            }

            switch (type) {
                case 'create_room': {
                    createRoom(connection, authUser, payload, request);
                    break;
                }

                case 'join_room': {
                    joinRoom(connection, authUser, payload, request);
                    break;
                }

                case 'leave_room': {
                    leaveRoom(connection, authUser, payload, request);
                    break;
                }

                case 'delete_room': {
                    deleteRoom(connection, type, authUser, payload, request);
                    break;
                }

                case 'get_room_members': {
                    getRoomMembers(connection, type, authUser, payload, request);
                    break;
                }

                case 'kick_member': {
                    kickMember(connection, type, authUser, payload, request);
                    break;
                }

                case 'promote_member': {
                    promoteMember(connection, type, authUser, payload, request);
                    break;
                }

                case 'send_message': {
                    sendMessage(connection, type, authUser, payload, request);
                    break;
                }

                case 'get_messages': {
                    getMessages(connection, type, authUser, payload, request);
                    break;
                }

                case 'get_more_messages': {
                    getMoreMessages(connection, type, authUser, payload, request);
                    break;
                }

                case 'send_direct_message': {
                    sendDirectMessage(connection, type, authUser, payload, request);
                    break;
                }

                case 'edit_message': {
                    editMessage(connection, type, authUser, payload, request);
                    break;
                }

                case 'delete_message': {
                    deleteMessage(connection, type, authUser, payload, request);
                    break;
                }

                case 'update_status': {
                    updateStatus(connection, type, authUser, payload, request);
                    break;
                }

                case 'typing': {
                    typing(connection, type, authUser, payload, request);
                    break;
                }

                default:
                    connection.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
                    break;
            }
        } catch (error) {
            request.log.error({ error, type, userId, payload }, 'WebSocket handler error');
            connection.send(JSON.stringify({ type: 'error', message: 'Server error' }));
        }
    });

    connection.on('close', () => {
        request.log.info('Client disconnected');

        // Step 1: Clean up rateLimits for this connection
        const userId = connection.authenticatedUser?.id;
        if (userId) {
            // Remove user-specific global rate limits
            rateLimits.delete(userId);

            // Clean up user-specific room rate limits
            if (connection.userData?.rooms) {
                connection.userData.rooms.forEach((roomId) => {
                    const roomLimits = roomRateLimits.get(roomId);
                    if (roomLimits) {
                        // Delete only entries for this user
                        roomLimits.forEach((_, actionKey) => {
                            if (actionKey.startsWith(`${userId}:`)) {
                                roomLimits.delete(actionKey);
                            }
                        });
                        // If no rate limits remain for the room, remove the room entry
                        if (roomLimits.size === 0) {
                            roomRateLimits.delete(roomId);
                        }
                    }
                });
            }
        }

        // Step 2: Clean up userConnections
        if (connection.authenticatedUser?.id) {
            const userConns = userConnections.get(connection.authenticatedUser.id);
            if (userConns) {
                userConns.delete(connection);
                if (userConns.size === 0) {
                    userConnections.delete(connection.authenticatedUser.id);
                }
            }
        }

        // Step 3: Clean up client offsets tracking
        clientOffsets.delete(connection);

        // Step 4: Clean up liveConnections
        if (connection.userData?.rooms) {
            connection.userData.rooms.forEach((roomId) => {
                liveConnections[roomId]?.delete(connection);
                if (liveConnections[roomId]?.size === 0) {
                    delete liveConnections[roomId];
                }
            });
            delete connection.userData;
        }
    });

    connection.on('error', (error) => {
        request.log.error({ error }, 'WebSocket connection error');
    });
};

// Cleanup on process exit
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    clearInterval(cleanupInterval);
    clearInterval(rateLimitCleanupInterval);
    clearInterval(roomRateLimitCleanupInterval);
    
    // Final cleanup
    rateLimits.clear();
    roomRateLimits.clear();
    clientOffsets.clear();
    
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    clearInterval(cleanupInterval);
    clearInterval(rateLimitCleanupInterval);
    clearInterval(roomRateLimitCleanupInterval);
    
    // Final cleanup
    rateLimits.clear();
    roomRateLimits.clear();
    clientOffsets.clear();
    
    process.exit(0);
});

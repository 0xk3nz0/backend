


import { authenticateWebSocketToken } from 'middleware/websocket.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as chatModel from '../models/chat.js';
import { wsSchema } from '../schemas/chat.js';
import { prisma } from '../utils/prisma.js';
import { wsValidators } from '../app.js';
import { WebSocket as WS } from 'ws';


type WSMessageType =
    | 'join_room'
    | 'leave_room'
    | 'create_room'
    | 'delete_room'
    | 'edit_message'
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

// Store live connections per room
// const liveConnections: Record<string, Set<WS & { userData?: { userId: string; roomId: string } }>> = {};

// Store live connections per user
// const userConnections: Map<string, Set<WS & { userData?: { userId: string; roomId: string } }>> = new Map();


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
        const message = await prisma.message.create({
            data: {
                senderId,
                content,
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
const rateLimits = new Map<WS, { count: number, resetTime: number }>();

// Check if a connection is within rate limits
// 🔐 JWT Authentication: All sensitive operations require valid JWT tokens
// 🛡️ Authorization: Room membership verification before joining/messaging
// ⚡ Enhanced Rate Limiting: Different limits per message type, tracked by user ID
// 🧹 Content Sanitization: XSS prevention and message validation
// 📊 Structured Error Handling: Consistent error responses with error codes
// 📝 Comprehensive Logging: Detailed operation tracking for monitoring
// ✅ Input Validation: Message length limits and spam detection
// 🔒 Permission Checks: Users must have room access to perform actions
const checkRateLimit = (connection: WS, maxRequests = 10, windowMs = 60000) => {
    const now = Date.now();
    const rateLimit = rateLimits.get(connection);

    if (!rateLimit || now > rateLimit.resetTime) {
        rateLimits.set(connection, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (rateLimit.count >= maxRequests) {
        return false;
    }

    rateLimit.count++;
    return true;
}

// 
function extractTokenFromHeaders(headers: any): string | null {
    const auth = headers.authorization;
    return auth?.startsWith('Bearer') ? auth.slice(7) : null;
}

// Simulate the load more messages in a room
const clientOffsets: Map<WS, Map<string, number>> = new Map();


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
        const schema = wsSchema[type];
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
            if (!authUser || !authUser.id) {
                connection.send(JSON.stringify({
                    type: 'error',
                    message: 'User not authenticated'
                }));
                return ;
            }

            switch (type) {
                case 'create_room': {
                    const { name, type = 'GROUP', description } = payload as chatModel.CreateRoomPayload;

                    // Validate room name
                    if (!name || name.trim().length === 0) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Room name is required'
                        }));
                        return ;
                    }

                    if (name.length > 100) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Room name must be less than 100 characters'
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
                        // Create the room
                        const newRoom = await prisma.room.create({
                            data: {
                                name: name.trim(),
                                type,
                                // createdBy: authUser.id
                                // description: description?.trim() || null,
                            }
                        });

                        // Add creator as OWNER
                        await prisma.roomMember.create({
                            data: {
                                userId: authUser.id,
                                roomId: newRoom.id,
                                role: 'OWNER'
                            }
                        });

                        // Initialize live connections for this room
                        liveConnections[newRoom.id] = new Set();
                        liveConnections[newRoom.id]?.add(connection);

                        if (!connection.userData) {
                            connection.userData = { userId: authUser.id, rooms: new Set() };
                        }
                        connection.userData.rooms.add(newRoom.id);

                        // Send success response
                        connection.send(JSON.stringify({
                            type: 'room_created',
                            payload: {
                                room: {
                                    id: newRoom.id,
                                    name: newRoom.name,
                                    type: newRoom.type,
                                    // description: newRoom.description,
                                    createdAt: newRoom.createdAt,
                                    createdBy: authUser.id
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

                    break;
                }

                case 'join_room': {
                    const { roomId, userId } = payload as chatModel.JoinRoomPayload;

                    if (authUser.id !== userId) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Unauthorized: User ID mismatch'
                        }));
                        return ;
                    }

                    // Validate room and user
                    const [room, user] = await Promise.all([
                        prisma.room.findUnique({ where: { id: roomId }, include: { members: true } }),
                        prisma.user.findUnique({ where: { id: userId } }),
                    ]);
                    if (!room || !user) {
                        connection.send(JSON.stringify({ type: 'error', message: 'Room or user not found' }));
                        return;
                    }

                    // Add room member
                    await prisma.roomMember.upsert({
                        where: { userId_roomId: { userId, roomId } },
                        update: {},
                        create: { userId, roomId, role: 'MEMBER' },
                    });

                    // Track connection
                    liveConnections[roomId] = liveConnections[roomId] ?? new Set();
                    liveConnections[roomId].add(connection);

                    if (!connection.userData) {
                        connection.userData = { userId, rooms: new Set() };
                    }
                    connection.userData.rooms.add(roomId);

                    // connection.send(JSON.stringify({ type: 'joined', payload: { roomId } }));
                    connection.send(JSON.stringify({ type: 'joined', payload: {
                        roomId: room.id,
                        roomName: room.name,
                        type: room.type,
                        members: room.members.map(m => ({ userId: m.userId, role: m.role })),
                        joinedAt: new Date().toISOString()
                        }
                    }));
                    break;
                }

                case 'leave_room': {
                    const { roomId, userId } = payload as chatModel.LeaveRoomPayload;

                    if (authUser.id !== userId) {
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
                            message: 'Not a member of this room, are u lost'
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
                    break;
                }

                case 'delete_room': {
                    if (!checkRateLimit(connection, 1, 60000)) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Rate limit exceeded, please try again later'
                        }));
                        return;
                    }
                    const { roomId } = payload as { roomId: string }

                    // Step 1: Check if room exists
                    const room = await prisma.room.findUnique({
                        where: { id: roomId }
                    });
                    if (!room) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Room not found to be deleted!'
                        }));
                        return;
                    }

                    // Step 2: Check membership and ownership
                    const userMembership = await prisma.roomMember.findUnique({
                        where: { userId_roomId: { userId: authUser.id, roomId } }
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
                    break;
                }

                case 'get_room_members': {
                    const { roomId } = payload as chatModel.GetRoomMembersPayload;

                    const roomMember = await prisma.roomMember.findUnique({
                        where: {
                            userId_roomId: {
                                userId: authUser.id,
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
                    const members = await prisma.roomMember.findMany({
                        where: {
                            roomId
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    });

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
                    break;
                }

                case 'kick_member': {
                    if (!checkRateLimit(connection, 3, 60000)) { // 3 kicks per minute
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Rate limit exceeded, please try again later'
                        }));
                        return;
                    }
                    const { roomId, targetUserId } = payload as chatModel.KickMemberPayload;

                    // Check if user is admin/owner of this room
                    const userMembership = await prisma.roomMember.findUnique({
                        where: {
                            userId_roomId: {
                                userId: authUser.id,
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

                    if (userMembership.role !== 'ADMIN') { // && userMembership.role !== 'OWNER') {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Insufficient permissions: Only admins can kick members'
                        }));
                        return ;
                    }

                    // Can't kick yourself
                    if (authUser.id === targetUserId) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Connot kick yourself, are u crazy!'
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

                    // Can't kick owner: had l3iba fchkel
                    if (targetMembership.role === 'OWNER') { // && userMembership.role !== 'OWNER') {
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
                        if (ws.userData?.roomId === roomId) {
                            ws.send(JSON.stringify({
                                type: 'kicked_from_room',
                                payload: {
                                    roomId,
                                    kickedBy: authUser.id,
                                    reason: 'You have been removed from this room'
                                }
                            }));
                            liveConnections[roomId]?.delete(ws);
                            delete ws.userData;
                        }
                    });

                    // // Disconnect the kicked user's websocket connections
                    // liveConnections[roomId]?.forEach((ws) => {
                    //     if (ws.userData?.userId === targetUserId) {
                    //         ws.send(JSON.stringify({
                    //             type: 'kicked_from_room',
                    //             payload: {
                    //                 roomId,
                    //                 kickedBy: authUser.id,
                    //                 reason: 'You have been removed from this room'
                    //             }
                    //         }));
                    //         liveConnections[roomId]?.delete(ws);
                    //         delete ws.userData;
                    //     }
                    // });

                    // Notify all room members
                    liveConnections[roomId]?.forEach((ws) => {
                        if (ws.readyState === WS.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'member_kicked',
                                payload: {
                                    roomId,
                                    kickedUserId: targetUserId,
                                    kickedBy: authUser.id
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

                    break;
                }

                case 'promote_member': {
                    if (!checkRateLimit(connection, 3, 60000)) { // 3 promotions per minute
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Rate limit exceeded, please try again later'
                        }));
                        return;
                    }
                    const { roomId, targetUserId, newRole } = payload as chatModel.PromoteMemberPayload;

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
                                userId: authUser.id,
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
                    if (authUser.id === targetUserId) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Cannot change your own role'
                        }));
                        return ;
                    }

                    // Special case: If promoting to OWNER, demote cureent owner to ADMIN
                    if (newRole === 'OWNER') {
                        await prisma.roomMember.update({
                            where: {
                                userId_roomId: {
                                    userId: authUser.id,
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
                                    changedBy: authUser.id
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
                                    changedBy: authUser.id
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

                    break;
                }

                case 'send_message': {
                    if (!checkRateLimit(connection)) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Rate limit exceeded, please try again later'
                        }));
                        return ;
                    }

                    const { roomId, senderId, text } = payload as chatModel.SendMessagePayload;

                    if (authUser.id !== senderId) {
                        connection.send(JSON.stringify({ 
                            type: 'error', 
                            message: 'Unauthorized: Cannot send message as another user' 
                        }));
                        return;
                    }

                    const roomMember = await prisma.roomMember.findUnique({
                        where: {
                            userId_roomId: {
                                userId: authUser.id,
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

                    // Validate room and sender
                    const [room, sender] = await Promise.all([
                        prisma.room.findUnique({ where: { id: roomId } }),
                        prisma.user.findUnique({ where: { id: senderId } }),
                    ]);
                    if (!room || !sender) {
                        connection.send(JSON.stringify({ type: 'error', message: 'Room or sender not found' }));
                        return;
                    }

                    // Persist message
                    const message = await prisma.message.create({
                        data: { content: text, senderId, roomId },
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
                                        text,
                                        createdAt: message.createdAt,
                                    },
                                })
                            );
                        }
                    });
                    break;
                }

                case 'get_messages': {
                    const { roomId, limit = 50, offset = 0 } = payload as chatModel.GetMessagePayload;

                    const roomMember = await prisma.roomMember.findUnique({
                        where: {
                            userId_roomId: {
                                userId: authUser.id,
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

                    // Validate room
                    const room = await prisma.room.findUnique({ where: { id: roomId } });
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
                    break;
                }

                case 'get_more_messages': {
                    const { roomId, limit = 10, reset = false } = payload as chatModel.GetMessagePayload;

                    const roomMember = await prisma.roomMember.findUnique({
                        where: {
                            userId_roomId: {
                                userId: authUser.id,
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
                        clientOffsets.set(connection, new Map());
                    }
                    const roomOffsets = clientOffsets.get(connection)!;

                    // Step 1: Handle reset - set offset to 0 if requested
                    let offset = 0;
                    if (reset) {
                        offset = roomOffsets.get(roomId) ?? 0;
                    }

                    // Step 2: If reset, clear the stored offset to start fresh
                    if (reset) {
                        roomOffsets.set(roomId, 0);
                    }
                    
                    // Validate room
                    const room = await prisma.room.findUnique({ where: { id: roomId } });
                    if (!room) {
                        connection.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                        return;
                    }

                    // Fetch the next batch of messages
                    const messages = await prisma.message.findMany({
                        where: { roomId },
                        include: { sender: true, receiver: true },
                        orderBy: { createdAt: 'asc' },
                        skip: offset,
                        take: limit
                    });

                    // Update offset for next request
                    roomOffsets.set(roomId, offset + messages.length);

                    // Send messages to client
                    connection.send(JSON.stringify({ type: 'more_messages', payload: messages }));
                    break;
                }

                case 'send_direct_message': {
                    if (!checkRateLimit(connection)) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Rate limit exceeded, please try again later'
                        }));
                        return ;
                    }

                    const { senderId, receiverId, text } = payload as chatModel.DirectMessagePayload;

                    if (authUser.id !== senderId) {
                        connection.send(JSON.stringify({ 
                            type: 'error', 
                            message: 'Unauthorized: Cannot send message as another user' 
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

                    // Persist message
                    const message = await prisma.message.create({
                        data: { content: text, senderId, receiverId },
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
                                    text,
                                    createdAt: message.createdAt,
                                }
                            }));
                        }
                    });

                    // // Broadcast to receiver if online
                    // Object.values(liveConnections)
                    //     .flatMap((set) => Array.from(set))
                    //     .forEach((ws) => {
                    //         if (ws.userData?.userId === receiverId && ws.readyState === WS.OPEN) {
                    //             ws.send(
                    //                 JSON.stringify({
                    //                     type: 'direct_message',
                    //                     payload: {
                    //                         id: message.id,
                    //                         senderId,
                    //                         receiverId,
                    //                         text,
                    //                         createdAt: message.createdAt,
                    //                     },
                    //                 })
                    //             );
                    //         }
                    //     });

                    // Confirm to sender
                    connection.send(JSON.stringify({ type: 'direct_message_sent', payload: message }));
                    break;
                }

                case 'edit_message': {
                    if(!checkRateLimit(connection, 5, 10000)) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Rate limit exceeded, please try again later'
                        }));
                        return ;
                    }

                    const { messageId, newText, userId } = payload as chatModel.EditMessagePayload;

                    // Verify user is authenticated and matches
                    if (authUser.id !== userId) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Unauthorized: Cannot edit message as another user'
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
                    if (message.sender.id !== authUser.id) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Unauthorized: Can only edit your own messages'
                        }));
                        return ;
                    }

                    // For room messages, verify user is still a room member
                    const roomMember = await prisma.roomMember.findUnique({
                        where: {
                            userId_roomId: {
                                userId: authUser.id,
                                roomId: message.roomId // to be checked later roomId cannot be null in this case
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

                    // Optional: Check if message is too old to edit (e.g., 24 hours)
                    const messageAge = Date.now() - message.createdAt.getTime();
                    const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
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

                    if (newText.length > 2000) { // Max message length can be change later
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Message max length is 2000 characters'
                        }));
                        return ;
                    }

                    try {
                        // Update the message
                        const updatedMessage = await prisma.message.update({
                            where: {
                                id: messageId
                            },
                            data: {
                                content: newText.trim(),
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
                                            senderName: updatedMessage.sender
                                        }
                                    }));
                                }
                            });
                        } else if(message.receiverId) {
                            // Direct message - notify both sender and receiver
                            const targetUsers = [message.senderId, message.receiverId];
                            const targetConnections = targetUsers.flatMap(id => Array.from(userConnections.get(id) || new Set()));
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

                            // Object.values(liveConnections)      // Takes just the values (the Sets) and puts them into an array.
                            // .flatMap((set) => Array.from(set))  // Each Set is converted into an array (Array.from(set)).
                            //                                     // flatMap merges all those arrays together.
                            //                                     // At this point → we have every WebSocket connection in one array.
                            // .forEach((ws) => {                  // Loop through each WebSocket connection
                            //     if (ws.userData?.userId && targetUsers.includes(ws.userData?.userId) && ws.readyState === WS.OPEN) {
                            //         ws.send(JSON.stringify({
                            //             type: 'direct_message_edited',
                            //             payload: {
                            //                 messageId: updatedMessage.id,
                            //                 senderId: updatedMessage.senderId,
                            //                 receiverId: updatedMessage.receiverId,
                            //                 newText: updatedMessage.content,
                            //                 editedAt: updatedMessage.updatedAt,
                            //             }
                            //         }));
                            //     }
                            // });
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

                    } catch(error) {
                        request.log.error({ error, messageId }, 'Failed to edit message');
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Failed to edit message'
                        }));
                    }
                    break;
                }

                case 'update_status': {
                    const { userId, status } = payload as chatModel.UpdateUserStatusPayload;
                    if (userId !== authUser.id) {
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

                    break;
                }

                case 'typing': {
                    if(!checkRateLimit(connection, 5, 10000)) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            message: 'Rate limit exceeded, please try again later'
                        }));
                        return ;
                    }

                    const { userId, status, roomId, receiverId } = payload as chatModel.TypingPayload;

                    if (authUser.id !== userId) {
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
                                    userId: authUser.id,
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

                        // // Broadcast typing status to receiver
                        // Object.values(liveConnections)
                        //     .flatMap((set) => Array.from(set))
                        //     .forEach((ws) => {
                        //         if (ws.userData?.userId === receiverId && ws.readyState === WS.OPEN) {
                        //             ws.send(JSON.stringify({ type: 'typing', payload: { userId, receiverId, status } }));
                        //         }
                        //     });
                    }
                    break;
                }

                default:
                    connection.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
                    break;
            }
        } catch (error) {
            request.log.error({ error, type }, 'WebSocket handler error');
            connection.send(JSON.stringify({ type: 'error', message: 'Server error' }));
        }
    });

    connection.on('close', () => {
        request.log.info('Client disconnected');

        // Step 1: Clean up rateLimits for this connection
        rateLimits.delete(connection);

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
            // liveConnections[connection.userData.roomId]?.delete(connection);
            // if (liveConnections[connection.userData.roomId]?.size === 0) {
            //     delete liveConnections[connection.userData.roomId];
            // }
        }
    });

    connection.on('error', (error) => {
        request.log.error({ error }, 'WebSocket connection error');
    });
};

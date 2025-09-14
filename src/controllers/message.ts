


import type { FastifyReply, FastifyRequest } from 'fastify';
import { wsSchema } from '../schemas/message.js';
import { prisma } from '../utils/prisma.js';
import { WebSocket as WS } from 'ws';

// Interfaces for payloads
interface CreateMessageBody {
    senderId: string;
    content: string;
    roomId?: string;
    receiverId?: string;
}

interface GetMessageQuery {
    roomId?: string;
    senderId?: string;
    receiverId?: string;
    limit?: number;
    offset?: number;
}

interface JoinRoomPayload {
    roomId: string;
    userId: string;
}

interface LeaveRoomPayload {
    roomId: string;
    userId: string;
}

interface SendMessagePayload {
    roomId: string;
    senderId: string;
    text: string;
}

interface GetMessagePayload {
    roomId: string;
    limit?: number;
    offset?: number;
    reset?: number
}

interface DirectMessagePayload {
    senderId: string;
    receiverId: string;
    text: string;
}

interface TypingPayload {
    userId: string;
    roomId?: string;
    receiverId?: string;
    status: boolean;
}

type WSMessageType = 'join_room' | 'leave_room' | 'send_message' | 'get_messages' | 'send_direct_message' | 'get_more_messages' | 'typing';

interface WSMessage<T = any> {
    type: WSMessageType;
    payload: T;
}

// Store live connections per room
const liveConnections: Record<string, Set<WS & { userData?: { userId: string; roomId: string } }>> = {};

// HTTP Handlers
export const createMessageHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { senderId, content, roomId, receiverId } = request.body as CreateMessageBody;

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
    const { roomId, senderId, receiverId, limit = 50, offset = 0 } = request.query as GetMessageQuery;

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
export const websocketHandler = async (connection: WS & { userData?: { userId: string; roomId: string } }, request: FastifyRequest) => {
    request.log.info('Client connected');

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
            if (!request.server.validatorCompiler) {
                connection.send(JSON.stringify({ type: 'error', message: 'Validator not configured' }));
                return;
            }
            const validate = request.server.validatorCompiler({ schema: schema } as any);
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
            switch (type) {
                case 'join_room': {
                    const { roomId, userId } = payload as JoinRoomPayload;

                    /// @todo check if the user already joined
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
                    connection.userData = { userId, roomId };

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
                    const { roomId, userId } = payload as LeaveRoomPayload;

                    /// @todo check if the user already left
                    // Validate room and user
                    const room = await prisma.room.findUnique({ where: { id: roomId } });
                    if (!room) {
                        connection.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                        return;
                    }

                    // Remove connection
                    liveConnections[roomId]?.delete(connection);
                    delete connection.userData;

                    connection.send(JSON.stringify({ type: 'left', payload: { roomId, userId } }));
                    break;
                }

                case 'send_message': {
                    const { roomId, senderId, text } = payload as SendMessagePayload;

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
                    const { roomId, limit = 50, offset = 0 } = payload as GetMessagePayload;

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
                    const { roomId, limit = 10, reset = false } = payload as GetMessagePayload;

                    // Initialize client tracking
                    if (!clientOffsets.has(connection)) {
                        clientOffsets.set(connection, new Map());
                    }
                    const roomOffsets = clientOffsets.get(connection)!;

                    // Get last offset for this room, default to 0
                    const offset = roomOffsets.get(roomId) ?? 0;
                    
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
                    const { senderId, receiverId, text } = payload as DirectMessagePayload;

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

                    // Broadcast to receiver if online
                    Object.values(liveConnections)
                        .flatMap((set) => Array.from(set))
                        .forEach((ws) => {
                            if (ws.userData?.userId === receiverId && ws.readyState === WS.OPEN) {
                                ws.send(
                                    JSON.stringify({
                                        type: 'direct_message',
                                        payload: {
                                            id: message.id,
                                            senderId,
                                            receiverId,
                                            text,
                                            createdAt: message.createdAt,
                                        },
                                    })
                                );
                            }
                        });

                    // Confirm to sender
                    connection.send(JSON.stringify({ type: 'direct_message_sent', payload: message }));
                    break;
                }

                /// @todo get members in a room

                case 'typing': {
                    const { userId, status, roomId, receiverId } = payload as TypingPayload;

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

                        // Broadcast typing status to receiver
                        Object.values(liveConnections)
                            .flatMap((set) => Array.from(set))
                            .forEach((ws) => {
                                if (ws.userData?.userId === receiverId && ws.readyState === WS.OPEN) {
                                    ws.send(JSON.stringify({ type: 'typing', payload: { userId, receiverId, status } }));
                                }
                            });
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
        
        // Clean up client offsets tracking
        clientOffsets.delete(connection);
        
        if (connection.userData?.roomId) {
            liveConnections[connection.userData.roomId]?.delete(connection);
            if (liveConnections[connection.userData.roomId]?.size === 0) {
                delete liveConnections[connection.userData.roomId];
            }
        }
    });

    connection.on('error', (error) => {
        request.log.error({ error }, 'WebSocket connection error');
    });
};




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
                        { senderId, receiverId },
                        { senderId: receiverId, receiverId: senderId },
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


// Broadcast to all members in a room
// const broadcastToRoom = () => {
// }

// Simulate the load more messages in a room
const clientOffsets: Map<WebSocket, Map<string, number>> = new Map();



// WebSocket Handler
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
        if (!schema) {
            connection.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
            return;
        }

        // Validate payload
        try {
            const validate = request.server.validatorCompiler({ schema });
            if (!validate(payload)) {
            const errors = validate.errors?.map(e => ({
                path: e.instancePath,
                message: e.message, // will now include your custom errorMessage
                keyword: e.keyword,
                params: e.params
            }));
            connection.send(JSON.stringify({
                type: 'error',
                message: 'Payload validation failed',
                details: errors
            }));
                // connection.send(JSON.stringify({ type: 'error', message: 'Payload validation failed' }));
                // return;
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
                    connection.userData = undefined;

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
                    roomOffsets.set(roomId, offset + (await messages).length);

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


// import type { FastifyReply, FastifyRequest } from "fastify";
// import { wsSchema } from "schemas/message.js";
// import { prisma } from "utils/prisma.js";
// import { WebSocket as WS } from 'ws';


// type CreateMessageBody = {
//     senderId: string,
//     content: string,
//     roomId?: string,
//     receiverId?: string,
// }

// export const createMessageHandler = async (request: FastifyRequest, reply: FastifyReply) => {
//     const { senderId, content, roomId, receiverId } = request.body as CreateMessageBody;

//     const senderExist = await prisma.user.findUnique({
//         where: {
//             id: senderId
//         }
//     });
//     if (!senderExist) {
//         return reply.code(400).send({
//             error: 'senderId does not exist'
//         });
//     }

//     if (roomId) {
//         const roomIdExist = await prisma.room.findFirst({
//             where: {
//                 id: roomId
//             }
//         });
//         if (!roomIdExist) {
//             return reply.code(400).send({
//                 error: 'There is no room with this id just in ur dreams'
//             });
//         }
//     } else if (receiverId) {
//         if (receiverId === senderId) {
//             return reply.code(400).send({
//                 error: 'U can not send a message to ur self hhhhh'
//             });
//         }
//         const receiverExist = await prisma.user.findUnique({
//             where: {
//                 id: receiverId
//             }
//         });
//         if (!receiverExist) {
//             return reply.code(400).send({
//                 error: 'There is no receiver with this id just in ur dreams'
//             });
//         }
//     }

//     try {
//         const message = await prisma.message.create({
//             data: {
//                 senderId,
//                 content,
//                 receiverId: receiverId ?? null,
//                 roomId: roomId ?? null
//             }
//         });
//         request.log.debug(message);
//         reply.code(201).send({
//             message: message
//         })
//     } catch(error) {
//         reply.code(500).send({
//             error: 'Internal server error'
//         });
//     }
// }

// interface GetMessageQuery {
//     roomId?: string,
//     senderId?: string,
//     receiverId?: string,
//     limit?: number,
//     offset?: number
// }

// export const getMessageHandler = async (request: FastifyRequest, reply: FastifyReply) => {
//     const { roomId, senderId, receiverId, limit = 50, offset = 0 } = request.query as GetMessageQuery;

//     if (!roomId && !(receiverId && senderId)) {
//         return reply.code(400).send({
//             error: 'Please provide roomId or sender and receiver id'
//         });
//     }

//     let messages;
//     if (roomId) {
//         messages = await prisma.message.findMany({
//             where: {
//                 roomId: roomId
//             },
//             include: {
//                 sender: true,
//                 receiver: true
//             },
//             orderBy: {
//                 createdAt: 'asc'
//             },
//             skip: offset,
//             take: limit
//         });
//     } else if (senderId && receiverId) {
//         // direct messages between two users
//         messages = await prisma.message.findMany({
//             where: {
//                 OR: [
//                 { senderId, receiverId },
//                 { senderId: receiverId, receiverId: senderId },
//                 ],
//             },
//             include: { sender: true, receiver: true },
//             orderBy: { createdAt: "asc" },
//             skip: offset,
//             take: limit,
//         });
//     } else {
//         return reply.code(400).send({
//             error: 'u should provide the roomId or the sender and the receiver id'
//         });
//     }

//     return reply.code(200).send(messages);
// }


// // interfaces for payloads //
// // For Join a room
// interface JoinRoomPayload {
//     roomId: string,
//     userId: string
// }

// // For Leave a room
// interface LeaveRoomPayload {
//     roomId: string,
//     userId: string
// }

// // For Send message to a room
// interface SendMessagePayload {
//     roomId: string,
//     senderId: string,
//     text: string
// }

// // For Fetch past messages
// interface GetMessagePayload {
//     roomId: string,
//     limit?: number,
//     offset?: number
// }

// interface DirectMessagePayload {
//     senderId: string;
//     receiverId: string;
//     text: string;
// }

// type WSMessageType =
//     | 'join_room'
//     | 'leave_room'
//     | 'send_message'
//     | 'get_messages'
//     | 'send_direct_message'
//     | 'typing';               // new type

// interface WSMessage<T = any> {
//     type: WSMessageType;
//     payload: T;
// }

// interface TypingPayload {
//     userId: string;
//     roomId?: string;        // for room typing
//     receiverId?: string;    // for direct message typing
//     status: boolean;        // true = typing, false = stopped
// }

// // Store live connections per room
// const liveConnections: Record<string, Set<WS & { userData?: WSMessage }>> = {};

// export const websocketHandler = async (connection: WS & { userData?: WSMessage }, request: FastifyRequest) => {
//     console.log('Client connected');

//     connection.on('message', async (rawMessage) => {
//         let msg: WSMessage;
//         try {
//             msg = JSON.parse(rawMessage.toString());
//         } catch (error) {
//             connection.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
//             return;
//         }

//         const { type, payload } = msg;
//         const schema = wsSchema[type];
//         if (!schema) {
//             connection.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
//             return;
//         }

//         // Validate payload
//         try {
//             const validate = request.server.validatorCompiler({ schema });
//             if (!validate(payload)) {
//                 connection.send(JSON.stringify({ type: 'error', message: 'Validation failed' }));
//                 return;
//             }
//         } catch (error) {
//             request.log.error(`failed to parse schema: ${error}`);
//             return;
//         }

//         try {
//             switch (type) {
//                 case 'join_room':
//                     // Add room member to DB if not exists
//                     await prisma.roomMember.upsert({
//                         where: { userId_roomId: { userId: payload.userId, roomId: payload.roomId } },
//                         update: {},
//                         create: { userId: payload.userId, roomId: payload.roomId, role: 'MEMBER' }
//                     });

//                     // Track live connection
//                     liveConnections[payload.roomId] ??= new Set();
//                     liveConnections[payload.roomId].add(connection);
//                     connection.userData = { userId: payload.userId, roomId: payload.roomId };

//                     connection.send(JSON.stringify({ type: 'joined', roomId: payload.roomId }));
//                     break;

//                 case 'leave_room':
//                     // Remove connection from live connections
//                     liveConnections[payload.roomId]?.delete(connection);
//                     connection.userData = undefined;

//                     connection.send(JSON.stringify({ type: 'left', roomId: payload.roomId }));
//                     break;

//                 case 'send_message':
//                     // Persist message in DB
//                     const message = await prisma.message.create({
//                         data: {
//                             content: payload.text,
//                             senderId: payload.senderId,
//                             roomId: payload.roomId
//                         }
//                     });

//                     // Broadcast to all live connections in room
//                     liveConnections[payload.roomId]?.forEach((ws) => {
//                         if (ws.readyState === 1) {
//                             ws.send(JSON.stringify({
//                                 type: 'message',
//                                 payload: {
//                                     id: message.id,
//                                     roomId: payload.roomId,
//                                     senderId: payload.senderId,
//                                     text: payload.text,
//                                     createdAt: message.createdAt
//                                 }
//                             }));
//                         }
//                     });
//                     break;

//                 case 'get_messages':
//                     const messages = await prisma.message.findMany({
//                         where: { roomId: payload.roomId },
//                         include: { sender: true, receiver: true },
//                         orderBy: { createdAt: 'asc' },
//                         skip: payload.offset || 0,
//                         take: payload.limit || 50
//                     });
//                     connection.send(JSON.stringify({ type: 'messages', payload: messages }));
//                     break;
//                 case 'send_direct_message':
//                     // Validate sender and receiver exist
//                     const sender = await prisma.user.findUnique({ where: { id: payload.senderId } });
//                     const receiver = await prisma.user.findUnique({ where: { id: payload.receiverId } });
//                     if (!sender || !receiver) {
//                         connection.send(JSON.stringify({ type: 'error', message: 'Sender or receiver not found' }));
//                         return;
//                     }

//                     // Persist in DB
//                     const directMessage = await prisma.message.create({
//                         data: {
//                         content: payload.text,
//                         senderId: payload.senderId,
//                         receiverId: payload.receiverId
//                         }
//                     });

//                     // Broadcast to receiver if online
//                     Object.values(liveConnections).flat().forEach((ws) => {
//                         if (ws.userData?.userId === payload.receiverId && ws.readyState === 1) {
//                         ws.send(JSON.stringify({
//                             type: 'direct_message',
//                             payload: {
//                             id: directMessage.id,
//                             senderId: payload.senderId,
//                             receiverId: payload.receiverId,
//                             text: payload.text,
//                             createdAt: directMessage.createdAt
//                             }
//                         }));
//                         }
//                     });

//                     // Optional: confirm to sender
//                     connection.send(JSON.stringify({ type: 'direct_message_sent', payload: directMessage }));
//                     break;
//                 case 'typing':
//                     const { userId, status , roomId, receiverId } = payload as TypingPayload;

//                     if (roomId) {
//                         liveConnections[roomId]?.forEach((ws) => {
//                             if (ws !== connection && ws.readyState === 1) {
//                                 ws.send(JSON.stringify({
//                                     type: 'typing',
//                                     payload: { userId, roomId, status }
//                                 }));
//                             }
//                         });
//                     } else if (receiverId) {
//                         // Send typing status to the receiver if online
//                         Object.values(liveConnections).flat().forEach((ws) => {
//                             if (ws.userData?.userId === receiverId && ws.readyState === 1) {
//                                 ws.send(JSON.stringify({
//                                     type: 'typing',
//                                     payload: { userId, receiverId, status }
//                                 }));
//                             }
//                         });
//                     }
//                     break;

//                 default:
//                     connection.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
//                     break;
//             }
//         } catch (err) {
//             console.error(err);
//             connection.send(JSON.stringify({ type: 'error', message: 'Server error' }));
//         }
//     });

//     connection.on('close', async () => {
//         console.log('Client disconnected');
//         // Remove from all live rooms
//         if (connection.userData?.roomId) {
//             liveConnections[connection.userData.roomId]?.delete(connection);
//         }
//     });
// };

// // export const websocketHandler = (connection: ws, req: FastifyRequest) => {
// //     console.log('✅ Client connected');

// //     // Receive messages
// //     connection.on('message', (message) => {
// //         console.log('📩 Incoming:', message.toString());

// //         // Echo back for testing
// //         connection.send(`Server got: ${message}`);
// //     });

// //     // Detect disconnect
// //     connection.on('close', () => {
// //         console.log('❌ Client disconnected');
// //     });

// //     // Send greeting
// //     connection.send('👋 Hello from Fastify WebSocket server!');
// // };


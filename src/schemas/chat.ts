

import { CONFIG } from '../controllers/chat.js';

export const createMessageSchema = {
    body: {
        type: 'object',
        required: ['content', 'senderId'],
        properties: {
            content: { type: 'string', minLength: 1, maxLength: 2000, },
            senderId: { type: 'string', format: 'uuid', },
            receiverId: { type: 'string', format: 'uuid', },
            roomId: { type: 'string', format: 'uuid' },
        },
        oneOf: [
            { required: ['receiverId'], not: { required: ['roomId'] } },
            { required: ['roomId'], not: { required: ['receiverId'] } },
        ],
        errorMessage: {
            required: {
                content: 'Message content is required',
                senderId: 'Sender ID is required',
            },
            oneOf: 'You must provide either a receiverId or a roomId (but not both).',
        },
        additionalProperties: false,
    },
    response: {
        201: {
            type: 'object',
            properties: {
                message: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        content: { type: 'string' },
                        senderId: { type: 'string', format: 'uuid' },
                        receiverId: { type: ['string', 'null'], format: 'uuid' },
                        roomId: { type: ['string', 'null'], format: 'uuid' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                    required: ['id', 'content', 'senderId', 'createdAt', 'updatedAt'],
                },
            },
            required: ['message'],
        },
        400: {
            type: 'object',
            properties: {
                error: { type: 'string' },
            },
            required: ['error'],
        },
        500: {
            type: 'object',
            properties: {
                error: { type: 'string' },
            },
            required: ['error'],
        },
    },
};

export const getMessageSchema = {
    querystring: {
        type: 'object',
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            senderId: { type: 'string', format: 'uuid' },
            receiverId: { type: 'string', format: 'uuid' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
        },
        oneOf: [
            { required: ['roomId'] },
            { required: ['senderId', 'receiverId'] },
        ],
        errorMessage: {
            oneOf: 'You must provide either a roomId or both senderId and receiverId.',
        },
    },
    response: {
        200: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    content: { type: 'string' },
                    senderId: { type: 'string', format: 'uuid' },
                    receiverId: { type: ['string', 'null'], format: 'uuid' },
                    roomId: { type: ['string', 'null'], format: 'uuid' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    sender: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', format: 'uuid' },
                            // Add other user fields as needed
                        },
                    },
                    receiver: {
                        type: ['object', 'null'],
                        properties: {
                            id: { type: 'string', format: 'uuid' },
                            // Add other user fields as needed
                        },
                    },
                },
                required: ['id', 'content', 'senderId', 'createdAt', 'updatedAt'],
            },
        },
        400: {
            type: 'object',
            properties: {
                error: { type: 'string' },
            },
            required: ['error'],
        },
    },
};

export const chatSchema = {
    join_room: {
        type: 'object',
        required: ['roomId', 'userId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                userId: 'userId is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    leave_room: {
        type: 'object',
        required: ['roomId', 'userId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                userId: 'userId is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    send_message: {
        type: 'object',
        required: ['roomId', 'senderId', 'text'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            senderId: { type: 'string', format: 'uuid' },
            text: { type: 'string', minLength: 1, maxLength: CONFIG.MESSAGE.MAX_LENGTH },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                senderId: 'senderId is required',
                text: 'text is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                senderId: 'senderId must be a valid UUID string',
                text: `text must be a string between 1 and ${CONFIG.MESSAGE.MAX_LENGTH} characters`,
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    send_direct_message: {
        type: 'object',
        required: ['senderId', 'receiverId', 'text'],
        properties: {
            senderId: { type: 'string', format: 'uuid' },
            receiverId: { type: 'string', format: 'uuid' },
            text: { type: 'string', minLength: 1, maxLength: CONFIG.MESSAGE.MAX_LENGTH },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                senderId: 'senderId is required',
                receiverId: 'receiverId is required',
                text: 'text is required',
            },
            properties: {
                senderId: 'senderId must be a valid UUID string',
                receiverId: 'receiverId must be a valid UUID string',
                text: `text must be a string between 1 and ${CONFIG.MESSAGE.MAX_LENGTH} characters`,
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    edit_message: {
        type: 'object',
        required: ['messageId', 'newText', 'userId'],
        properties: {
            messageId: { type: 'string', format: 'uuid' },
            newText: { type: 'string', minLength: 1, maxLength: CONFIG.MESSAGE.MAX_LENGTH },
            userId: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                messageId: 'messageId is required',
                newText: 'newText is required',
                userId: 'userId is required',
            },
            properties: {
                messageId: 'messageId must be a valid UUID string',
                newText: `newText must be a string between 1 and ${CONFIG.MESSAGE.MAX_LENGTH} characters`,
                userId: 'userId must be a valid UUID string',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    delete_message: {
        type: 'object',
        required: ['messageId', 'userId'],
        properties: {
            messageId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                messageId: 'messageId is required',
                userId: 'userId is required',
            },
            properties: {
                messageId: 'messageId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    update_status: {
        type: 'object',
        required: ['userId', 'status'],
        properties: {
            userId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['IN_GAME', 'OFFLINE', 'ONLINE', 'BUSY'] },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                userId: 'userId is required',
                status: 'status is required',
            },
            properties: {
                userId: 'userId must be a valid UUID string',
                status: 'status must be one of: IN_GAME, OFFLINE, ONLINE, BUSY',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    typing: {
        type: 'object',
        required: ['userId', 'status'],
        properties: {
            userId: { type: 'string', format: 'uuid' },
            status: { type: 'boolean' },
            roomId: { type: 'string', format: 'uuid' },
            receiverId: { type: 'string', format: 'uuid' },
        },
        oneOf: [
            { required: ['roomId'], not: { required: ['receiverId'] } },
            { required: ['receiverId'], not: { required: ['roomId'] } },
        ],
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                userId: 'userId is required',
                status: 'status is required',
            },
            properties: {
                userId: 'userId must be a valid UUID string',
                status: 'status must be a boolean',
                roomId: 'roomId must be a valid UUID string',
                receiverId: 'receiverId must be a valid UUID string',
            },
            oneOf: 'You must provide either a roomId or a receiverId (but not both).',
            additionalProperties: 'No extra properties allowed',
        },
        additionalProperties: false,
    },
    create_room: {
        type: 'object',
        required: ['name', 'userId'],
        properties: {
            userId: { type: 'string', format: 'uuid' },
            name: { type: 'string', minLength: 1, maxLength: CONFIG.ROOM.MAX_NAME_LENGTH },
            type: { type: 'string', enum: ['GROUP', 'DIRECT'], default: 'GROUP' },
            description: { type: 'string', maxLength: 1000, nullable: true },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                name: 'name is required',
                userId: 'userId is required',
            },
            properties: {
                userId: 'userId must be a valid UUID string',
                name: `name must be a string between 1 and ${CONFIG.ROOM.MAX_NAME_LENGTH} characters`,
                type: 'type must be one of: GROUP, DIRECT',
                description: 'description must be a string up to 1000 characters',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    delete_room: {
        type: 'object',
        required: ['roomId', 'userId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                userId: 'userId is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    get_room_members: {
        type: 'object',
        required: ['roomId', 'userId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                userId: 'userId is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    get_messages: {
        type: 'object',
        required: ['roomId', 'userId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                userId: 'userId is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
                limit: 'limit must be an integer between 1 and 100',
                offset: 'offset must be a non-negative integer',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    get_more_messages: {
        type: 'object',
        required: ['roomId', 'userId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
            reset: { type: 'boolean', default: false },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                userId: 'userId is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
                limit: 'limit must be an integer between 1 and 100',
                reset: 'reset must be a boolean',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    kick_member: {
        type: 'object',
        required: ['roomId', 'targetUserId', 'userId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            targetUserId: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                userId: 'userId is required',
                targetUserId: 'targetUserId is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
                targetUserId: 'targetUserId must be a valid UUID string',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
    promote_member: {
        type: 'object',
        required: ['roomId', 'targetUserId', 'newRole', 'userId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            targetUserId: { type: 'string', format: 'uuid' },
            newRole: { type: 'string', enum: ['MEMBER', 'ADMIN', 'OWNER'] },
        },
        additionalProperties: false,
        errorMessage: {
            type: 'Payload must be an object',
            required: {
                roomId: 'roomId is required',
                userId: 'userId is required',
                targetUserId: 'targetUserId is required',
                newRole: 'newRole is required',
            },
            properties: {
                roomId: 'roomId must be a valid UUID string',
                userId: 'userId must be a valid UUID string',
                targetUserId: 'targetUserId must be a valid UUID string',
                newRole: 'newRole must be one of: MEMBER, ADMIN, OWNER',
            },
            additionalProperties: 'No extra properties allowed',
        }
    },
};

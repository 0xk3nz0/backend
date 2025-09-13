


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

export const wsSchema = {
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
    },
    send_message: {
        type: 'object',
        required: ['roomId', 'senderId', 'text'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            senderId: { type: 'string', format: 'uuid' },
            text: { type: 'string', minLength: 1, maxLength: 2000 },
        },
        additionalProperties: false,
    },
    get_messages: {
        type: 'object',
        required: ['roomId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'number', minimum: 0, default: 0 },
        },
        additionalProperties: false,
    },
    get_more_messages: {
        type: 'object',
        required: ['roomId'],
        properties: {
            roomId: { type: 'string', format: 'uuid' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'number', minimum: 0, default: 0 },
        },
        additionalProperties: false,
    },
    send_direct_message: {
        type: 'object',
        required: ['senderId', 'receiverId', 'text'],
        properties: {
            senderId: { type: 'string', format: 'uuid' },
            receiverId: { type: 'string', format: 'uuid' },
            text: { type: 'string', minLength: 1, maxLength: 2000 },
        },
        additionalProperties: false,
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
            oneOf: 'You must provide either a roomId or a receiverId (but not both).',
        },
        additionalProperties: false,
    },
};


// export const createMessageSchema = {
//     body: {
//         type: 'object',
//         required: ['content', 'senderId'],
//         properties: {
//             content: {
//                 type: 'string',
//                 minLength: 1,
//                 maxLength: 2000
//             },
//             senderId: {
//                 type: 'string',
//                 format: 'uuid'
//             },
//             receiverId: {
//                 type: 'string',
//                 format: 'uuid'
//             },
//             roomId: {
//                 type: 'string',
//                 format: 'uuid'
//             }
//         },
//         oneOf: [
//             { required: ["receiverId"] },
//             { required: ["roomId"] }
//         ],
//         errorMessage: {
//             required: {
//                 content: "Message content is required",
//                 senderId: "SenderId is required"
//             },
//             oneOf: "You must provide either a receiverId or a roomId (but not both)."
//         },
//         additionalProperties: false,
//         // allOf: [
//         //     {
//         //         if: {
//         //             not: {
//         //                 required: ['roomId', 'receivedId']
//         //             }
//         //         },
//         //         then: {
//         //             errorMessage: 'Either roomId or receiverId must be provided'
//         //         }
//         //     }
//         // ]
//     },
//     response: {
//         201: {
//             type: 'object',
//             properties: {
//                 message: {
//                     type: 'object',
//                     properties: {
//                         id: {
//                             type: 'string',
//                             format: 'uuid'
//                         },
//                         content: {
//                             type: 'string',
//                         },
//                         senderId: {
//                             type: 'string',
//                             format: 'uuid'
//                         },
//                         receiverId: {
//                             type: 'string',
//                             format: 'uuid'
//                         },
//                         roomId: {
//                             type: 'string',
//                             format: 'uuid'
//                         },
//                         createdAt: {
//                             type: 'string',
//                             format: 'date-time'
//                         },
//                         updatedAt: {
//                             type: 'string',
//                             format: 'date-time'
//                         }
//                     }
//                 }
//             }
//         }
//     }
// }


// export const getMessageSchema = {
//     querystring: {
//         type: 'object',
//         properties: {
//             roomId: {
//                 type: 'string',
//                 format: 'uuid'
//             },
//             senderId: {
//                 type: 'string',
//                 format: 'uuid'
//             },
//             receiverId: {
//                 type: 'string',
//                 format: 'uuid'
//             },
//             limit: {
//                 type: 'integer',
//                 minimum: 1,
//                 maximum: 100
//             },
//             offset: {
//                 type: 'integer',
//                 minimum: 0
//             }
//         },
//         oneOf: [
//             {
//                 required: ['roomId'],
//             },
//             {
//                 required: ['senderId', 'receiverId']
//             }
//         ]
//     }
//     // ,
//     // response: {
//     //     200: {
//     //         type: 'object'
//     //     },
//     //     400: {
//     //         type: 'object'
//     //     }
//     // }
// }
// export const wsSchema = {
//     join_room: {
//         type: 'object',
//         required: ['roomId', 'userId'],
//         properties: {
//             roomId: { type: 'string', format: 'uuid' },
//             userId: { type: 'string', format: 'uuid' }
//         }
//     },
//     leave_room: {
//         type: 'object',
//         required: ['roomId', 'userId'],
//         properties: {
//             roomId: { type: 'string', format: 'uuid' },
//             userId: { type: 'string', format: 'uuid' }
//         }
//     },
//     send_message: {
//         type: 'object',
//         required: ['roomId', 'senderId', 'text'],
//         properties: {
//             roomId: { type: 'string', format: 'uuid' },
//             senderId: { type: 'string', format: 'uuid' },
//             text: { type: 'string' }
//         }
//     },
//     get_messages: {
//         type: 'object',
//         required: ['roomId'],
//         properties: {
//             roomId: { type: 'string', format: 'uuid' },
//             limit: { type: 'number', minimum: 1, maximum: 100 },
//             offset: { type: 'number', minimum: 0 }
//         }
//     },
//     send_direct_message: {
//         type: 'object',
//         required: ['senderId', 'receiverId', 'text'],
//         properties: {
//             senderId: { type: 'string', format: 'uuid' },
//             receiverId: { type: 'string', format: 'uuid' },
//             text: { type: 'string' }
//         }
//     },
//     typing: {
//         type: 'object',
//         required: ['userId', 'status'],
//         properties: {
//             userId: { type: 'string', format: 'uuid' },
//             status: { type: 'boolean' },
//             roomId: { type: 'string', format: 'uuid' },      // optional for room typing
//             receiverId: { type: 'string', format: 'uuid' }   // optional for direct typing
//         }
//     }
// };



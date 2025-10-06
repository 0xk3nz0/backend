


export const createRoomSchema = {
    body: {
        type: 'object',
        required: ['type', 'creatorId'],
        properties: {
            name: {
                type: 'string',
                minLength: 3,
                maxLength: 30
            },
            type: {
                type: 'string',
                enum: ['DIRECT', 'GROUP']
            },
            creatorId: {
                type: 'string',
                format: 'uuid'
            },
            members: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: {
                            type: 'string',
                            format: 'uuid'
                        },
                        role: {
                            type: 'string',
                            enum: ['ADMIN', 'MEMBER'],
                            default: 'MEMBER'
                        }
                    }
                }
            }
        },
        errorMessage: 'The body must have room name and creatorId',
        additionalProperties: false,
        allOf: [
            {
                if: {
                    properties: {
                        type: {
                            const: 'GROUP'
                        }
                    }
                },
                then: {
                    required: ['name']
                }
            }
        ]
    },
    response: {
        201: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    format: 'uuid'
                },
                name: {
                    type: 'string'
                },
                type: {
                    type: 'string',
                },
                createdAt: {
                    type: 'string',
                    format: 'date-time'
                },
                updatedAt: {
                    type: 'string',
                    format: 'date-time'
                },
                creatorId: {
                    type: 'string',
                    format: 'uuid'
                },
                members: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                format: 'uuid'
                            },
                            userId: {
                                type: 'string',
                                format: 'uuid'
                            },
                            role: {
                                type: 'string'
                            },
                            joinedAt: {
                                type: 'string',
                                format: 'date-time'
                            }
                        }
                    }
                }
            }
        }
    },
    // 400: {

    // }
}

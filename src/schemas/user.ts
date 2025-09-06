export const userRegisterSchema = {
    body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
            name: {
                type: 'string',
                minLength: 3
            },
            email: {
                type: 'string',
                format: 'email'
            },
            password: {
                type: 'string',
                minLength: 8,
                // pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$'
                // ✅ at least 8 chars, one letter, one number
            }
        }
    },
    response: {
        201: {
            type: 'object',
            properties: {
                message: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        username: { type: 'string' },
                        createdAt: { type: 'string' }
                    }
                },
                token: { type: 'string' }
            }
        }
    }
}

export const userLoginSchema = {
    body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: {
                type: 'string',
                format: 'email'
            },
            password: {
                type: 'string',
                minLength: 8
            },
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                uid: { type: 'string' },
                message: { type: 'string' }
            }
        },
        404: {
            type: 'object',
            properties: {
                statusCode: { type: 'number' },
                message: { type: 'string' }
            }
        },
        401: {
            type: 'object',
            properties: {
                statusCode: { type: 'number' },
                message: { type: 'string' }
            }
        }
    }
};

export const userProfileSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                uid: { type: 'string' },
                name: { type: 'string' },
                createdAt: { type: 'string' }
            }
        },
        401: {
            type: 'object',
            properties: {
                message: { type: 'string' }
            }
        }
    }
};

export const userProfileUpdateSchema = {
    body: {
        type: 'object',
        properties: {
            field: {
                type: 'string',
                enum: [
                    'name',
                    'avatar'
                ]
            },
            value: { type: 'string' }
        },
        required: [ 'field', 'value' ]
    },
    response: {
        200: {
            type: 'object',
            properties: {
                message: { type: 'string' }
            },
            required: [ 'message' ]
        }
    }
};

export const userRegisterSchema = {
    tags: [ "users" ],
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
                errorMessage: 'passwors too weak'
            }
        },
        errorMessage: 'The body must have name, email, and a strong password',
        additionalProperties: false
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
    tags: [ "users" ],
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
                access_token: { type: 'string' },
                refresh_token: { type: 'string' },
                uid: { type: 'string' },
                message: { type: 'string' }
            }
            // properties: {
            //     uid: { type: 'string' },
            //     message: { type: 'string' }
            // }
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
    tags: [ "users" ],
    response: {
        200: {
            type: 'object',
            properties: {
                uid: { type: 'string' },
                name: { type: 'string' },
                avatar: { type: 'string' },
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
    tags: [ "users" ],
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

export const userLogoutSchema = {
    tags: [ "users" ],
    response: {
        200: {
            type: 'object',
            properties: {
                message: { type: 'string' }
            }
        },
        400: {
            type: 'object',
            properties: {
                statusCode: { type: 'number' },
                error: { type: 'string' },
                message: { type: 'string' }
            }
        },
        401: {
            type: 'object',
            properties: {
                statusCode: { type: 'number' },
                error: { type: 'string' },
                message: { type: 'string' }
            }
        }
    }
}

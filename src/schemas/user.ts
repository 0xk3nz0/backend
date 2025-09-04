


// User creation schema
export const userRegisterSchema = {
    body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
            name: {
                type: 'string',
                minLength: 3,
                maxLength: 30,
                pattern: '^[a-zA-Z\\s]+$'
            },
            email: {
                type: 'string',
                format: 'email',
                maxLength: 255
            },
            password: {
                type: 'string',
                minLength: 8,
                maxLength: 30,
                pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'
            },
            // age: {
            //     type: 'integer',
            //     minimum: 13,
            //     maximum: 120
            // }
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
        properties: {
            email: { type: 'string' },
            password: { type: 'string' },
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

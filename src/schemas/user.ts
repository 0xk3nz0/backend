


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
                /*
                What this enforces:
                    (?=.*[a-z]) → at least 1 lowercase letter
                    (?=.*[A-Z]) → at least 1 uppercase letter
                    (?=.*\d) → at least 1 digit
                    (?=.*[@$!%*?&]) → at least 1 special character from @$!%*?&
                    [A-Za-z\d@$!%*?&]{8,} → only allowed characters, and at least 8 characters long
                    ^...$ → anchors to match the entire string
                Example matches ✅
                    Abcd1234! → ✅
                    StrongPass1@ → ✅
                    Test123$ → ✅
                Example failures ❌
                    abcdefg → ❌ (no uppercase, digit, or special char)
                    ABCDEFG1! → ❌ (no lowercase)
                    Abc!1 → ❌ (too short)*/
                pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$",
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

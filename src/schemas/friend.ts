


export const sendFriendRequestSchema = {
    tags: [ "friends" ],
    body: {
        type: 'object',
        required: ['requested_uid'],
        properties: {
            requested_uid: { type: 'string' }
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                request: { type: 'object' }
            }
        }
    }
};

export const resolveFriendRequestSchema = {
    tags: [ "friends" ],
    body: {
        type: 'object',
        required: ['request_id', 'action'],
        properties: {
            request_id: { type: 'string' },
            action: { type: 'boolean' }
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                message: { type: 'string' },
                newStatus: {
                    type: 'string',
                    enum: ['ACCEPTED', 'REJECTED']
                }
            }
        },
        404: {
            type: 'object',
            properties: {
                message: { type: 'string' }
            }
        }
    }
}

export const getFriendsSchema = {
    tags: [ "friends" ],
    response: {
        200: {
            type: 'array',
            items: { type: 'string' }
        }
    }
}

export const getPendingRequestsSchema = {
    tags: [ "friends" ],
    response: {
        200: {
            type: 'array',
            items: { type: 'string' }
        }
    }
}

export const getIncomingRequestsSchema = {
    tags: [ "friends" ],
    response: {
        200: {
            type: 'array',
            items: { type: 'string' }
        }
    }
};

export const blockUserSchema = {
    tags: [ "friends" ],
    body: {
        type: 'object',
        required: ['blocked_uid'],
        properties: {
            blocked_uid: { type: 'string' }
        }
    }
}

export const unblockUserSchema = {
    tags: [ "friends" ],
    body: {
        type: 'object',
        required: ['blocked_uid'],
        properties: {
            blocked_uid: { type: 'string' }
        }
    }
}

export const getBlockedUsersSchema = {
    tags: [ "friends" ],
    response: {
        200: {
            type: 'array',
            items: { type: 'string' }
        }
    }
}

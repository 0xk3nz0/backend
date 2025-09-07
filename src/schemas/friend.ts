import {getPendingRequestsController} from "../controllers/friend.js";


export const sendFriendRequestSchema = {
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
    response: {
        200: {
            type: 'array',
            items: { type: 'string' }
        }
    }
}

export const getPendingRequestsSchema = {
    response: {
        200: {
            type: 'array',
            items: { type: 'string' }
        }
    }
}

export const getIncomingRequestsSchema = {
    response: {
        200: {
            type: 'array',
            items: { type: 'string' }
        }
    }
};

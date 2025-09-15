

export interface CreateMessageBody {
    senderId: string;
    content: string;
    roomId?: string;
    receiverId?: string;
}

export interface GetMessageQuery {
    roomId?: string;
    senderId?: string;
    receiverId?: string;
    limit?: number;
    offset?: number;
}

export interface JoinRoomPayload {
    roomId: string;
    userId: string;
}

export interface LeaveRoomPayload {
    roomId: string;
    userId: string;
}

export interface SendMessagePayload {
    roomId: string;
    senderId: string;
    text: string;
}

export interface GetMessagePayload {
    roomId: string;
    limit?: number;
    offset?: number;
    reset?: number
}

export interface DirectMessagePayload {
    senderId: string;
    receiverId: string;
    text: string;
}

export interface TypingPayload {
    userId: string;
    roomId?: string;
    receiverId?: string;
    status: boolean;
}

export interface GetRoomMembersPayload {
    roomId: string;
}

export interface KickMemberPayload {
    roomId: string;
    targetUserId: string;
}

export interface PromoteMemberPayload {
    roomId: string;
    targetUserId: string;
    newRole: 'MEMBER' | 'ADMIN' | 'OWNER';
}

export interface CreateRoomPayload {
    name: string;
    type?: 'DIRECT' | 'GROUP'; // | 'CHANNEL';
    description?: string;
}

export interface UpdateUserStatusPayload {
    status: 'ONLINE' | 'AWAY' | 'BUSY' | 'IN_GAME' | 'OFFLINE';
}


export type WSMessageType =
    | 'create_room'
    | 'join_room'
    | 'leave_room'
    | 'send_message'
    | 'get_messages'
    | 'send_direct_message'
    | 'get_more_messages'
    | 'get_room_members'
    | 'kick_member'
    | 'promote_member'
    | 'typing';

export interface WSMessage<T = any> {
    type: WSMessageType;
    payload: T;
}
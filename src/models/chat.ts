

export interface CreateRoomPayload {
    userId: string;
    name: string;
    type?: 'DIRECT' | 'GROUP';
    description?: string | null;
}

export interface DeleteRoomPayload {
    userId: string;
    roomId: string;
}

export interface GetRoomMembersPayload {
    userId: string;
    roomId: string;
}

export interface GetMessagePayload {
    userId: string;
    roomId: string;
    limit?: number;
    offset?: number;
    reset?: number;
}

export interface GetMoreMessagesPayload {
    userId: string;
    roomId: string;
    limit?: number;
    reset?: boolean;
}

export interface KickMemberPayload {
    userId: string;
    roomId: string;
    targetUserId: string;
}

export interface PromoteMemberPayload {
    userId: string;
    roomId: string;
    targetUserId: string;
    newRole: 'MEMBER' | 'ADMIN' | 'OWNER';
}

export interface JoinRoomPayload {
    userId: string;
    roomId: string;
}

export interface LeaveRoomPayload {
    userId: string;
    roomId: string;
}

export interface SendMessagePayload {
    senderId: string;
    roomId: string;
    text: string;
}

export interface DirectMessagePayload {
    senderId: string;
    receiverId: string;
    text: string;
}

export interface EditMessagePayload {
    userId: string;
    messageId: string;
    newText: string;
}

export interface DeleteMessagePayload {
    userId: string;
    messageId: string;
}

export interface UpdateUserStatusPayload {
    userId: string;
    status: 'IN_GAME' | 'OFFLINE' | 'ONLINE' | 'BUSY';
}

export interface TypingPayload {
    userId: string;
    status: boolean;
    roomId?: string;
    receiverId?: string;
}

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
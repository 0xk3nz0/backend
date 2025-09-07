import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";

const rooms = new Map(); // { roomName -> Set of connections }

const broadcast = (room, msg, sender) => {
    const clients = rooms.get(room) || new Set();
    for (const client in clients) {
        if (client !== sender && client.readyState === 1)
        {
            client.send(msg);
        }
    }
}

export default async (fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> => {

    fastify.get('/chat:room', { websocket: true }, (connection: WebSocket.webSocket, request: FastifyRequest<{ Params: { room: any } }>) => {
        const room = request.params.room;
        console.log(`New client joined room: ${room}`);

        if(!rooms.has(room)) {
            rooms.set(room, new Set());
        }
        rooms.get(room).add(connection.socket);

        connection.on("message", (msg) => {
            console.log(`[${room}] ${msg}`);
            broadcast(room, msg.toString(), connection.socket);
        });

        connection.on("close", () => {
            console.log(`Client left room: ${room}`);
            rooms.get(room).delete(connection.socket);
        });
    });


    // const room = "room1";
    // const socket = new WebSocket(`ws://localhost:3000/chat/${room}`);

    // socket.onopen = () => {
    // console.log(`Connected to ${room}`);
    // socket.send("Hello everyone!");
    // };

    // socket.onmessage = (event) => {
    // console.log("New message:", event.data);
    // };

}


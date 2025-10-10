import type { FastifyRequest } from 'fastify';

export async function handleGameWebSocket(connection: any, request: FastifyRequest) {
  console.log(' New WebSocket connection established');

  connection.on('message', (message: Buffer) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log('Received message:', parsedMessage);

      if (parsedMessage.type === 'ping') {
        connection.socket.send(JSON.stringify({ type: 'pong' }));
      }

    } catch (error) {
      console.log('❌ Invalid message format');
    }
  });

  connection.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to game server'
  }));
}

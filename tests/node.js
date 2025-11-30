import WebSocket from 'ws';

const token = 'YOUR_JWT_TOKEN_HERE';

const ws = new WebSocket('ws://localhost:3000/v1/game/ws/game', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

ws.on('open', () => {
  console.log('Connected!');
  ws.send(JSON.stringify({ type: 'ping' }));
});

ws.on('message', (msg) => {
  console.log('Received:', msg.toString());
});

ws.on('close', (code, reason) => {
  console.log(`Disconnected (${code}): ${reason}`);
});


import WebSocket from 'ws';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjM0IiwidXNlcm5hbWUiOiJIYW16YSIsImlhdCI6MTc2MDExODQxNiwiZXhwIjoxNzYwMTIyMDE2fQ.OcNd9kkiTXJqJC8r8Xqwu01GMpWtDHNMQb5Doiy02sE';

const ws = new WebSocket('ws://localhost:3000/v1/game/ws/game', {
  headers: { Authorization: `Bearer ${token}` },
});

ws.on('open', () => {
  console.log('✅ Connected to WebSocket!');
  ws.send(JSON.stringify({ type: 'ping' })); // test ping
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log(`❌ Disconnected: ${code} ${reason}`);
});

ws.on('error', (err) => {
  console.error('⚠️ WebSocket error:', err.message);
});



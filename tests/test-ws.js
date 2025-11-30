import WebSocket from 'ws';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMDAxIiwidXNlcm5hbWUiOiJtZXJ5IiwiaWF0IjoxNzYwMTk5NjE1LCJleHAiOjE3NjAyMDMyMTV9.gs8iNdKdrxpsuqxypGEREtXdUiYnU2Ap4l26Na3kmkI';

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


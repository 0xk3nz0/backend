import WebSocket from 'ws';

// --- REPLACE THESE WITH YOUR VALID JWT TOKENS ---
const TOKENS = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMDAxIiwidXNlcm5hbWUiOiJtZXJ5IiwiaWF0IjoxNzYwMTk5NjE1LCJleHAiOjE3NjAyMDMyMTV9.gs8iNdKdrxpsuqxypGEREtXdUiYnU2Ap4l26Na3kmkI',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMDAyIiwidXNlcm5hbWUiOiJoYW16YSIsImlhdCI6MTc2MDE5OTYxNSwiZXhwIjoxNzYwMjAzMjE1fQ.6GNZvGXLn8MabBEG244xzmW7oot5DgBihajxIzmnRp4',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMDAzIiwidXNlcm5hbWUiOiJheml6IiwiaWF0IjoxNzYwMTk5NjE1LCJleHAiOjE3NjAyMDMyMTV9.fcstwRJvNgTPcOqoyBK2cqzYyo4ZLIT_4a_qEUfl5tI',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMDA0IiwidXNlcm5hbWUiOiJzYXJhIiwiaWF0IjoxNzYwMTk5NjE1LCJleHAiOjE3NjAyMDMyMTV9.HH1CJoNDlTE-Xp48xVNwLROYL7fh6yW1FgCOBTa-WwQ'
];

const WS_URL = 'ws://localhost:3000/v1/game/ws/game';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectPlayer(token, index) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    ws.on('open', () => {
      console.log(`✅ Player ${index + 1} connected`);
      ws.send(JSON.stringify({ type: 'matchmaking', payload: { action: 'join', gameType: 'classic' } }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log(`📩 [Player ${index + 1}]`, msg);

      if (msg.type === 'game_matched') {
        console.log(`🎮 [Player ${index + 1}] Matched in game:`, msg.payload.id);
      }
    });

    ws.on('close', () => {
      console.log(`🔌 Player ${index + 1} disconnected`);
    });

    ws.on('error', (err) => reject(err));
  });
}

async function main() {
  console.log('🚀 Starting 4-player matchmaking test...');

  for (let i = 0; i < TOKENS.length; i++) {
    await delay(300); // small delay to avoid 429 or overload
    connectPlayer(TOKENS[i], i);
  }

  // Keep the script alive for a bit to observe matchmaking
  await delay(15000);
  console.log('🧾 Test finished. Check backend logs for gameSessions and queue size.');
}

main().catch(console.error);

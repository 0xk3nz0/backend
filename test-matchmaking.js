import WebSocket from 'ws';

// 🧩 CONFIG
const BASE_URL = 'ws://localhost:3000/v1/game/ws/game';
const TOKENS = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjM0IiwidXNlcm5hbWUiOiJIYW16YSIsImlhdCI6MTc2MDEyOTUxMSwiZXhwIjoxNzYwMTMzMTExfQ.VivI7G22Fqk6QlH1_jBDhHgUAMZwjz01BK-nsPyehxs',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjM0NSIsInVzZXJuYW1lIjoiYmFyZGEiLCJpYXQiOjE3NjAxMjk1OTIsImV4cCI6MTc2MDEzMzE5Mn0.qPZqJYAVnwtmtm6YP-4xApLVOqk_jDsTZOWINUP6vd8',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjM0NTYiLCJ1c2VybmFtZSI6Inpha2FyaWEiLCJpYXQiOjE3NjAxMjk2MjcsImV4cCI6MTc2MDEzMzIyN30.UgKVzmu4H_FWDW6cS9VotYBKlmo7OdMaY23jgdIK-Do',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjM0NTY3IiwidXNlcm5hbWUiOiJyYXlhbiIsImlhdCI6MTc2MDEyOTY2MiwiZXhwIjoxNzYwMTMzMjYyfQ.CKh1sm386OB2kFEX00NdH8dNtjPraX00_WaM9Z7mGUw',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjM0NTY3OCIsInVzZXJuYW1lIjoibWVyeSIsImlhdCI6MTc2MDEyOTcwMSwiZXhwIjoxNzYwMTMzMzAxfQ.2goX_6fnG_CdvMIsmMy0gXG_3jHeMHRywH1PcRtdrxo'
]; // provide real tokens for each user
const MAX_RETRIES = 3;
const CONNECT_DELAY = 500; // ms delay between each connection

class GameTester {
  constructor(playerName, token) {
    this.playerName = playerName;
    this.token = token;
    this.ws = null;
  }

  async connect(retry = 0) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(BASE_URL, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      ws.on('open', () => {
        this.ws = ws;
        console.log(`✅ ${this.playerName} connected`);
        resolve();
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log(`📨 ${this.playerName} received:`, msg.type);

        if (msg.type === 'welcome') return;

        if (msg.type === 'game_matched') {
          console.log(`🎮 ${this.playerName} matched to game ${msg.payload.id}`);
          this.sendReady(msg.payload.id);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 ${this.playerName} disconnected: ${code} - ${reason}`);
      });

      ws.on('error', (err) => {
        if (err.message.includes('429') && retry < MAX_RETRIES) {
          console.log(`⚠️ ${this.playerName} got 429, retrying in 1s...`);
          setTimeout(() => {
            this.connect(retry + 1).then(resolve).catch(reject);
          }, 1000);
        } else {
          console.log(`❌ ${this.playerName} connection error: ${err.message}`);
          reject(err);
        }
      });
    });
  }

  joinMatchmaking() {
    this.ws.send(
      JSON.stringify({
        type: 'matchmaking',
        payload: { action: 'join', gameType: 'classic' }
      })
    );
    console.log(`🔍 ${this.playerName} joined matchmaking`);
  }

  sendReady(gameId) {
    this.ws.send(
      JSON.stringify({
        type: 'game_ready',
        payload: { gameId }
      })
    );
    console.log(`✅ ${this.playerName} is ready`);
  }

  move(direction) {
    this.ws.send(
      JSON.stringify({
        type: 'player_move',
        payload: {
          direction,
          gameId: 'test-game',
          timestamp: Date.now()
        }
      })
    );
    console.log(`🎮 ${this.playerName} moved: ${direction}`);
  }
}

// 🧠 Helper to wait
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// 🚀 Stress test
async function stressTest() {
  console.log('🎮 Starting stress test...\n');

  const players = TOKENS.map(
    (token, i) => new GameTester(`Player_${i + 1}`, token)
  );

  // Connect players sequentially (avoid rate-limit)
  for (let i = 0; i < players.length; i++) {
    await players[i].connect();
    await sleep(CONNECT_DELAY);
  }

  // Join matchmaking
  for (const player of players) {
    player.joinMatchmaking();
    await sleep(300);
  }

  // Move simulation loop
  const directions = ['up', 'down', 'left', 'right'];
  for (let t = 0; t < 5; t++) {
    for (const player of players) {
      const dir = directions[Math.floor(Math.random() * directions.length)];
      player.move(dir);
    }
    await sleep(500);
  }

  console.log('\n✅ Stress test completed — closing connections...');
  players.forEach((p) => p.ws.close());
  process.exit(0);
}

stressTest();

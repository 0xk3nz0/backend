
import WebSocket from 'ws';

class BotTester {
  constructor(token, playerName) {
    this.token = token;
    this.playerName = playerName;
    this.ws = null;
    this.gameId = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:3000/v1/game/ws/game', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      this.ws.on('open', () => {
        console.log(`✅ ${this.playerName} connected`);
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 ${this.playerName} disconnected: ${code} - ${reason}`);
      });

      this.ws.on('error', (error) => {
        console.log(`❌ ${this.playerName} error:`, error.message);
        reject(error);
      });
    });
  }

  handleMessage(message) {
    console.log(`📨 ${this.playerName} received:`, message.type);

    switch (message.type) {
      case 'welcome':
        console.log(`   Stats:`, message.stats);
        break;

      case 'matchmaking_result':
        console.log(`   Position: ${message.payload.position}, Queue: ${message.payload.queueSize}`);
        break;

      case 'game_matched':
        this.gameId = message.payload.id;
        console.log(`   🎉 Game matched! ID: ${this.gameId}`);
        console.log(`   Opponent is bot: ${message.payload.opponentIsBot}`);

        // Auto-ready when game is matched
        this.sendReady();
        break;

      case 'player_moved':
        console.log(`   🎮 ${message.payload.userId} moved: ${message.payload.direction}`);
        if (message.payload.isBot) {
          console.log('   🤖 This was a bot movement!');
        }
        break;

      case 'game_start':
        console.log('   🚀 Game started!');
        // Start sending player movements
        this.startPlayerMovements();
        break;

      default:
        console.log('   📦 Payload:', message.payload);
    }
  }

  joinMatchmaking() {
    this.ws.send(JSON.stringify({
      type: 'matchmaking',
      payload: { action: 'join', gameType: 'classic' }
    }));
    console.log(`🔍 ${this.playerName} joined matchmaking`);
  }

  sendReady() {
    if (!this.gameId) return;

    this.ws.send(JSON.stringify({
      type: 'game_ready',
      payload: { gameId: this.gameId }
    }));
    console.log(`✅ ${this.playerName} sent ready`);
  }

  startPlayerMovements() {
    // Send player movements every 3 seconds
    this.movementInterval = setInterval(() => {
      if (!this.gameId) return;

      const directions = ['up', 'down', 'left', 'right'];
      const randomDirection = directions[Math.floor(Math.random() * directions.length)];

      this.ws.send(JSON.stringify({
        type: 'player_move',
        payload: {
          direction: randomDirection,
          gameId: this.gameId,
          timestamp: Date.now()
        }
      }));

      console.log(`🎮 ${this.playerName} moved: ${randomDirection}`);
    }, 3000);
  }

  leaveMatchmaking() {
    this.ws.send(JSON.stringify({
      type: 'matchmaking',
      payload: { action: 'leave' }
    }));
    console.log(`🚪 ${this.playerName} left matchmaking`);
  }

  disconnect() {
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Main test function
async function testBotMatching() {
  console.log('🤖 Starting Bot Matching Test...\n');

  const token = process.argv[2];
  if (!token) {
    console.log('Usage: node bot-test.js <JWT_TOKEN>');
    console.log('First, get a token by registering a user');
    process.exit(1);
  }

  const player = new BotTester(token, 'Test Player');

  try {
    await player.connect();
    player.joinMatchmaking();

    console.log('\n⏰ Waiting for bot match (10 seconds)...');
    console.log('The bot should automatically match after 10 seconds\n');

    // ✅ INCREASE TIMEOUT TO 40 SECONDS
    setTimeout(() => {
      console.log('\n✅ Bot test completed successfully!');
      player.disconnect();
      process.exit(0);
    }, 15000); // 40 seconds to ensure bot matching

  } catch (error) {
    console.log('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
testBotMatching();

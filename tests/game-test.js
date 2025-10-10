import WebSocket from 'ws';

// Configuration
const BASE_URL = 'ws://localhost:3000/v1/game/ws/game';
const TEST_TOKEN =
  process.argv[2] ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjM0IiwidXNlcm5hbWUiOiJIYW16YSIsImlhdCI6MTc2MDEyNjE5MSwiZXhwIjoxNzYwMTI5NzkxfQ.XVWvIBeh438EqsylhXeIV_tfriwZ0VcQ_OjO7cLLDvk';

async function testGameWebSocket() {
  console.log('🎮 Starting Game WebSocket Tests...\n');

  // Create connection
  console.log('1. Connecting to WebSocket...');
  const ws = new WebSocket(BASE_URL, {
    headers: {
      Authorization: `Bearer ${TEST_TOKEN}`,
    },
  });

  const directions = ['up', 'down', 'left', 'right', 'up', 'right'];

  ws.on('open', () => {
    console.log('✅ Connected successfully\n');

    // Test 2: Ping/Pong
    console.log('2. Testing ping/pong...');
    ws.send(JSON.stringify({ type: 'ping' }));

    // Test 3: Join matchmaking
    setTimeout(() => {
      console.log('\n3. Joining matchmaking...');
      ws.send(
        JSON.stringify({
          type: 'matchmaking',
          payload: { action: 'join', gameType: 'classic' },
        })
      );
    }, 1000);

    // Test 4: Simulate player movement
    setTimeout(() => {
      console.log('\n4. Testing player movement sequence...');
      const gameId = '123e4567-e89b-12d3-a456-426614174000'; // Example UUID

      directions.forEach((dir, index) => {
        setTimeout(() => {
          console.log(`➡️  Moving ${dir}`);
          ws.send(
            JSON.stringify({
              type: 'player_move',
              payload: {
                direction: dir,
                gameId,
                timestamp: Date.now(),
              },
            })
          );
        }, index * 500);
      });
    }, 2000);
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message);

    if (message.type === 'welcome') {
      console.log('👋 Welcome message received!');
    }

    if (message.type === 'pong') {
      console.log('🏓 Pong received!');
    }

    if (message.type === 'game_matched') {
      console.log('🎯 Matched! Sending ready...');
      ws.send(
        JSON.stringify({
          type: 'game_ready',
          payload: { gameId: message.payload.id },
        })
      );
    }

    if (message.type === 'game_update') {
      console.log(`🎮 Game update:`, message.payload);
    }

    if (message.type === 'error') {
      console.error('⚠️ Server Error:', message.payload);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed: ${code} - ${reason}`);
  });

  ws.on('error', (error) => {
    console.log('❌ Connection error:', error.message);
  });

  // Auto-close after tests
  setTimeout(() => {
    console.log('\n✅ All tests completed');
    ws.close();
    process.exit(0);
  }, 5000 + directions.length * 500);
}

// Run test
if (process.argv[2]) {
  testGameWebSocket();
} else {
  console.log('Usage: node game-test.js <JWT_TOKEN>');
  console.log('First, get a token by registering a user');
}

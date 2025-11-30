#!/usr/bin/env node

import WebSocket from 'ws';

console.log('🧪 Testing WebSocket Connection...\n');

const ws = new WebSocket('ws://localhost:3002/v1/game/ws/game');

ws.on('open', () => {
    console.log('✅ Connected to WebSocket');

    // Test basic ping
    ws.send(JSON.stringify({ type: 'ping' }));

    setTimeout(() => {
        console.log('🏆 Testing tournament creation...');
        ws.send(JSON.stringify({
            type: 'tournament_action',
            payload: {
                action: 'create',
                tournamentData: {
                    name: 'Simple Test Tournament',
                    maxPlayers: 4,
                    description: 'Testing',
                    isPrivate: false
                }
            }
        }));
    }, 1000);

    setTimeout(() => {
        console.log('📝 Getting tournaments list...');
        ws.send(JSON.stringify({ type: 'get_tournaments' }));
    }, 2000);

    setTimeout(() => {
        console.log('🧹 Closing connection...');
        ws.close();
        process.exit(0);
    }, 5000);
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message.type);
    console.log('   Data:', JSON.stringify(message, null, 2));
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed: ${code} - ${reason.toString()}`);
});

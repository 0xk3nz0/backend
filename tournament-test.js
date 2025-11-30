#!/usr/bin/env node

import WebSocket from 'ws';

class TournamentTester {
    constructor() {
        this.connections = [];
        this.players = [];
        this.tournamentId = null;
    }

    async createPlayer(playerId) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket('ws://localhost:3002/v1/game/ws/game');

            ws.on('open', () => {
                console.log(`✅ Player ${playerId} connected`);
                this.connections.push({ id: playerId, ws });
                this.players.push(playerId);

                // Send ping to establish connection
                ws.send(JSON.stringify({ type: 'ping' }));

                setTimeout(() => resolve(ws), 500);
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                console.log(`📨 ${playerId} received:`, message.type);

                if (message.type === 'tournament_action_result' && message.payload.success && message.payload.tournament) {
                    this.tournamentId = message.payload.tournament.id;
                    console.log(`🏆 Tournament created: ${this.tournamentId}`);
                }

                if (message.type === 'tournament_started') {
                    console.log(`🚀 Tournament started for ${playerId}!`);
                    console.log(`   Tournament data:`, message.payload.tournament);
                }

                if (message.type === 'tournament_match_ready') {
                    console.log(`🎮 ${playerId} got tournament match ready!`);
                    console.log(`   Game ID: ${message.payload.id}`);
                    console.log(`   Match details:`, message.payload);
                }

                if (message.type === 'tournament_round_started') {
                    console.log(`🔥 ${playerId} got round started!`);
                    console.log(`   Round: ${message.payload.round}`);
                    console.log(`   Matches:`, message.payload.matches);
                }
            });

            ws.on('error', (error) => {
                console.error(`❌ ${playerId} error:`, error.message);
                reject(error);
            });
        });
    }

    async createTournament() {
        const creator = this.connections[0];
        console.log(`🏆 Creating tournament with ${creator.id}...`);

        creator.ws.send(JSON.stringify({
            type: 'tournament_action',
            payload: {
                action: 'create',
                tournamentData: {
                    name: 'Test Tournament',
                    maxPlayers: 4,
                    description: 'Testing tournament system',
                    isPrivate: false
                }
            }
        }));

        await this.sleep(1000);
    }

    async joinAllPlayers() {
        console.log(`👥 Joining all players to tournament: ${this.tournamentId}`);

        // Skip the creator (already joined), join the rest
        for (let i = 1; i < this.connections.length; i++) {
            const player = this.connections[i];
            player.ws.send(JSON.stringify({
                type: 'tournament_action',
                payload: {
                    action: 'join',
                    tournamentId: this.tournamentId
                }
            }));
            await this.sleep(500);
        }

        await this.sleep(1000);
    }

    async startTournament() {
        const creator = this.connections[0];
        console.log(`🚀 Starting tournament...`);

        creator.ws.send(JSON.stringify({
            type: 'tournament_action',
            payload: {
                action: 'start',
                tournamentId: this.tournamentId
            }
        }));

        await this.sleep(2000);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        console.log(`🧹 Cleaning up...`);
        this.connections.forEach(({ id, ws }) => {
            ws.close();
            console.log(`   Closed ${id}`);
        });
    }
}

async function testTournament() {
    console.log('🧪 Testing Tournament System...\n');

    const tester = new TournamentTester();

    try {
        // Create 4 players
        console.log('📝 Creating 4 players...');
        for (let i = 1; i <= 4; i++) {
            await tester.createPlayer(`player-${i}`);
        }

        console.log('\n🏆 Step 1: Creating tournament...');
        await tester.createTournament();

        console.log('\n👥 Step 2: Joining all players...');
        await tester.joinAllPlayers();

        console.log('\n🚀 Step 3: Starting tournament...');
        await tester.startTournament();

        console.log('\n⏱️  Waiting 5 seconds to see tournament messages...');
        await tester.sleep(5000);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await tester.cleanup();
        process.exit(0);
    }
}

testTournament();

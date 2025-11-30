/**
 * Simple test file for tournament system
 * Run with: node tests/tournament-test.js (after building TypeScript)
 */

const WebSocket = require('ws');

class TournamentTester {
    constructor() {
        this.connections = new Map();
        this.playerIds = [];
    }

    async createConnections(count = 4) {
        console.log(`Creating ${count} test connections...`);

        for (let i = 0; i < count; i++) {
            const ws = new WebSocket('ws://localhost:3000/ws/game');
            const playerId = `test-player-${i + 1}`;

            ws.on('open', () => {
                console.log(`✅ Player ${playerId} connected`);
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                console.log(`📨 ${playerId} received:`, message.type, message.payload);

                // Handle specific events
                if (message.type === 'tournament_action_result' && message.payload.success) {
                    console.log(`🏆 ${playerId}: ${message.payload.message}`);
                }
            });

            ws.on('error', (error) => {
                console.error(`❌ ${playerId} error:`, error.message);
            });

            this.connections.set(playerId, ws);
            this.playerIds.push(playerId);

            // Wait a bit between connections
            await this.sleep(100);
        }

        // Wait for all connections to be established
        await this.sleep(1000);
    }

    async runTournamentTest() {
        console.log('\n🏆 Starting Tournament Test...\n');

        // Player 1 creates tournament
        const creator = this.connections.get('test-player-1');
        creator.send(JSON.stringify({
            type: 'tournament_action',
            payload: {
                action: 'create',
                tournamentData: {
                    name: 'Test Tournament',
                    maxPlayers: 8,
                    description: 'Automated test tournament',
                    isPrivate: false
                }
            }
        }));

        await this.sleep(500);

        // Get tournament list
        creator.send(JSON.stringify({
            type: 'get_tournaments'
        }));

        await this.sleep(500);

        // Other players join (simulate manual joining with tournament ID)
        // In a real scenario, you'd get the tournament ID from the tournament list
        // For testing, we'll use a placeholder that would be replaced with actual ID

        console.log('\n📝 To complete the test:');
        console.log('1. Check the server logs for the created tournament ID');
        console.log('2. Have other players join using that tournament ID');
        console.log('3. Start the tournament when you have 4+ players');
        console.log('4. Play matches and submit results\n');

        // Keep connections alive for manual testing
        console.log('💡 Connections will stay alive for 60 seconds for manual testing...');
        setTimeout(() => {
            this.cleanup();
        }, 60000);
    }

    sendJoinTournament(playerId, tournamentId) {
        const connection = this.connections.get(playerId);
        if (connection) {
            connection.send(JSON.stringify({
                type: 'tournament_action',
                payload: {
                    action: 'join',
                    tournamentId: tournamentId
                }
            }));
        }
    }

    sendStartTournament(playerId, tournamentId) {
        const connection = this.connections.get(playerId);
        if (connection) {
            connection.send(JSON.stringify({
                type: 'tournament_action',
                payload: {
                    action: 'start',
                    tournamentId: tournamentId
                }
            }));
        }
    }

    sendGameResult(playerId, gameId, winnerId) {
        const connection = this.connections.get(playerId);
        if (connection) {
            connection.send(JSON.stringify({
                type: 'game_result',
                payload: {
                    gameId: gameId,
                    winnerId: winnerId,
                    score: {
                        player1: 10,
                        player2: Math.floor(Math.random() * 9) // Random losing score
                    }
                }
            }));
        }
    }

    cleanup() {
        console.log('\n🧹 Cleaning up connections...');
        this.connections.forEach((ws, playerId) => {
            ws.close();
            console.log(`✅ Closed connection for ${playerId}`);
        });
        process.exit(0);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
async function runTest() {
    const tester = new TournamentTester();

    try {
        await tester.createConnections(4);
        await tester.runTournamentTest();
    } catch (error) {
        console.error('❌ Test failed:', error);
        tester.cleanup();
    }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\n👋 Exiting...');
    process.exit(0);
});

runTest();

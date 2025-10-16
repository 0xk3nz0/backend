import { string, success } from "zod";
import { prisma } from "../utils/prisma.js";
import { z } from 'zod';

export const playerMoveSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']),
  gameId: z.string().uuid(),
  timestamp: z.number()
});

export const gameJoinSchema = z.object({
  gameId: z.string().uuid().optional(),
  gameType: z.enum(['classic', 'tournament']).default('classic')
});

export const matchmakingSchema = z.object({
  action: z.enum(['join', 'leave']),
  gameType: z.enum(['classic', 'tournament']).default('classic')
});

export const gameReadySchema = z.object({
  gameId: z.string().min(1)
});

export type PlayerMoveInput = z.infer<typeof playerMoveSchema>;
export type GameJoinInput = z.infer<typeof gameJoinSchema>;
export type MatchmakingInput = z.infer<typeof matchmakingSchema>;
export type GameReadyInput = z.infer<typeof gameReadySchema>;

/**
 * Real-time multiplayer Pong game service.
 * Manages WebSocket connections, matchmaking, bot opponents, and game sessions.
 * Handles player movements, game state synchronization, and bot AI behavior.
 */
export class GameServices {
    private activeConnections = new Map<string, any>();
    private gameSessions = new Map<string, any>();
    private matchmakingQueue: string[] = [];
    private botConnections = new Map<string, any>();
    private matchmakingJoinTimes = new Map<string, number>();
    private botIntervals = new Map<string, NodeJS.Timeout>();
    private matchmakingInterval: NodeJS.Timeout | null = null;

    /**
     * Initializes the game service and starts the matchmaking processor.
     * Sets up periodic bot matching for players waiting longer than 10 seconds.
     */
    constructor() {
      this.startMatchmakingProcessor();
    }

    /**
     * Starts the periodic matchmaking processor.
     * Checks every 2 seconds for players to match or bots to assign.
     *
     * @private
     */
    private startMatchmakingProcessor() {
      this.matchmakingInterval = setInterval(() => {
        this.tryMatchPlayers('classic'); // Check for classic games
        // You can add other game types here
      }, 2000); // Check every 2 seconds
    }

    /**
     * Processes a player movement action in an active game.
     * Forwards the movement to other players in the same game session.
     *
     * @param {string} userId - The ID of the player making the move (can be bot or human).
     * @param {PlayerMoveInput} payload - Validated movement data including direction and game ID.
     * @returns {Promise<{success: boolean, message: string}>} Result of the movement processing.
     */
    async handlePlayerMove(userId: string, payload: PlayerMoveInput) {
        console.log(`🎮 ${userId.startsWith('bot-') ? '🤖 Bot' : 'Player'} ${userId} moved:`, payload);

        const gameSession = this.gameSessions.get(payload.gameId);
        if (gameSession) {
          // Forward movement to other players in the same game
          gameSession.players.forEach((playerId: string) => {
            if (playerId !== userId) {
              console.log(`📨 Notifying player ${playerId} about ${userId.startsWith('bot-') ? '🤖 bot' : 'player'} ${userId} movement`);
              this.notifyPlayer(playerId, {
                type: 'player_moved',
                payload: {
                  userId,
                  ...payload,
                  isBot: userId.startsWith('bot-')
                }
              });
            }
          });
        }

        return { success: true, message: 'Movement processed' };
    }

    /**
     * Handles a player's request to join a game.
     * Routes to either joining an existing game or entering matchmaking.
     *
     * @param {string} userId - The ID of the player requesting to join.
     * @param {GameJoinInput} payload - Validated join request with optional game ID and game type.
     * @returns {Promise<any>} Result of the join operation.
     */
    async handleGameJoin(userId: string, payload: GameJoinInput) {
      console.log(`Player ${userId} wants to join game:`, payload);
      if (payload.gameId) {
        return await this.joinExistingGame(userId, payload.gameId);
      } else {
        return await this.joinMatchmaking(userId, payload.gameType);
      }
    }

    /**
     * Processes matchmaking requests for joining or leaving the queue.
     *
     * @param {string} userId - The ID of the player making the matchmaking request.
     * @param {MatchmakingInput} payload - Validated matchmaking action (join/leave) and game type.
     * @returns {Promise<any>} Result of the matchmaking operation.
     */
    async handleMatchmaking(userId: string, payload: MatchmakingInput) {
      console.log(`🔍 Player ${userId} matchmaking:`, payload);

      if (payload.action === 'join') {
        return await this.joinMatchmaking(userId, payload.gameType);
      } else {
        return await this.leaveMatchmaking(userId);
      }
    }

    /**
     * Handles a player's ready signal for starting a game.
     * Starts the game when all players in the session are ready.
     *
     * @param {string} userId - The ID of the player signaling readiness.
     * @param {GameReadyInput} payload - Validated ready signal containing the game ID.
     * @returns {Promise<{success: boolean, message: string}>} Result of the ready signal processing.
     */
    async handleGameReady(userId: string, payload: GameReadyInput) {
        console.log(`Player ${userId} is ready for game:`, payload.gameId);

        const gameSession = this.gameSessions.get(payload.gameId);
        if (gameSession) {

          if (!gameSession.readyPlayers) gameSession.readyPlayers = new Set();
          gameSession.readyPlayers.add(userId);

          if (gameSession.readyPlayers.size === gameSession.players.length) {
            this.startGame(payload.gameId);
          }
        }
        return { success: true, message: 'Player ready' };
    }

    /**
     * Allows a player to join a specific existing game session.
     *
     * @private
     * @param {string} userId - The ID of the player wanting to join.
     * @param {string} gameId - The ID of the game session to join.
     * @returns {Promise<{success: boolean, gameId?: string, message: string}>} Result of the join operation.
     * @throws {Error} If the game is not found or is full.
     */
    private async joinExistingGame(userId: string, gameId: string) {
        const gameSession = this.gameSessions.get(gameId);
        if (!gameSession) {
          throw new Error('Game not found');
        }

        if (gameSession.players.includes(userId)) {
          return { success: true, gameId, message: 'Already in game' };
        }

        if (gameSession.players.length >= 2) { // Adjust for different game types
          throw new Error('Game is full');
        }

        gameSession.players.push(userId);
        this.notifyPlayers(gameSession.players, {
          type: 'player_joined',
          payload: { userId, gameId }
        });

        return { success: true, gameId };
    }

    /**
     * Adds a player to the matchmaking queue for the specified game type.
     * Tracks join times and attempts immediate matching with other players.
     *
     * @private
     * @param {string} userId - The ID of the player joining matchmaking.
     * @param {string} gameType - The type of game to queue for (classic, tournament, etc.).
     * @returns {Promise<{success: boolean, position: number, queueSize: number}>} Queue position and status.
     */
    private async joinMatchmaking(userId: string, gameType: string) {
        if (!this.matchmakingQueue.includes(userId)) {
          this.matchmakingQueue.push(userId);

          // track join times
          this.matchmakingJoinTimes.set(userId, Date.now());
        }

        console.log(`Matchmaking queue: ${this.matchmakingQueue.length} players`);

        await this.tryMatchPlayers(gameType);

        return {
          success: true,
          position: this.matchmakingQueue.indexOf(userId) + 1,
          queueSize: this.matchmakingQueue.length
        };
    }

    /**
     * Removes a player from the matchmaking queue.
     *
     * @private
     * @param {string} userId - The ID of the player leaving matchmaking.
     * @returns {Promise<{success: boolean, message: string}>} Result of the leave operation.
     */
    private async leaveMatchmaking(userId: string) {
        this.matchmakingQueue = this.matchmakingQueue.filter(id => id !== userId);
        return { success: true, message: 'Left matchmaking' };
    }

    /**
     * Attempts to match players in the queue or assign bots to waiting players.
     * Matches two players if available, or assigns a bot if a player has waited >10 seconds.
     *
     * @private
     * @param {string} gameType - The type of game to create matches for.
     */
    private async tryMatchPlayers(gameType: string) {
          if (this.matchmakingQueue.length >= 2) {
            const player1 = this.matchmakingQueue.shift()!;
            const player2 = this.matchmakingQueue.shift()!;
            console.log(`Matched players: ${player1} vs ${player2}`);
            await this.createGameSession(player1, player2, gameType);
            return ;
        }

        if (this.matchmakingQueue.length === 1) {
          const playerId = this.matchmakingQueue[0];
          if (!playerId)
            return ;

          const joinTime = this.matchmakingJoinTimes.get(playerId);
          if (!joinTime) {
            this.matchmakingJoinTimes.set(playerId, Date.now())
            return ;
          }

          const waitTime = Date.now() - joinTime;

          // 10 seconds for testing (change to 30000 for production)
          if (waitTime > 10000) {
            const player = this.matchmakingQueue.shift()!;
            const botId = `bot-${Date.now()}`;
            console.log(`🤖 Matching ${player} with bot ${botId}`);
            await this.createGameSession(player, botId, gameType);

            if (playerId)
              this.matchmakingJoinTimes.delete(playerId);
          }
        }
    }

    /**
     * Creates a new game session between two players (human or bot).
     * Generates unique game ID, sets up session data, and notifies participants.
     *
     * @private
     * @param {string} player1Id - The ID of the first player (always human).
     * @param {string} player2Id - The ID of the second player (human or bot).
     * @param {string} gameType - The type of game session (classic, tournament, etc.).
     * @returns {Promise<any>} The created game session object.
     */
    private async createGameSession(player1Id: string, player2Id: string, gameType: string) {
        const isPlayer2Bot = player2Id.startsWith('bot-');

        const gameSession = {
            id: `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            players: [player1Id, player2Id],
            gameType,
            status: 'starting' as const,
            createdAt: new Date(),
            isBotGame: isPlayer2Bot // Track if this is a bot game
        };

        this.gameSessions.set(gameSession.id, gameSession);

        // Notify both players
        this.notifyPlayer(player1Id, {
            type: 'game_matched',
            payload: { ...gameSession, yourPlayerId: player1Id, opponentIsBot: isPlayer2Bot  }
        });

        if (isPlayer2Bot) {
            this.startBotBehavior(gameSession, player2Id);
        } else {
          this.notifyPlayer(player2Id, {
              type: 'game_matched',
              payload: { ...gameSession, yourPlayerId: player2Id, opponentIsBot: false }
          });
        }

        return gameSession;
    }

    /**
     * Starts autonomous behavior for a Pong bot opponent.
     * Creates an interval timer that makes the bot move up/down randomly every 1.5 seconds.
     *
     * @private
     * @param {any} gameSession - The game session object containing the bot.
     * @param {string} botId - The unique identifier for the bot player.
     */
    private startBotBehavior(gameSession: any, botId: string) {
        console.log(`Starting Pong bot behavior for bot ${botId} in game ${gameSession.id}`);

        // For Pong, bot only moves up/down
        const pongDirections = ['up', 'down'];

        const botInterval = setInterval(() => {
            if (!this.gameSessions.has(gameSession.id)) {
                clearInterval(botInterval);
                this.botIntervals.delete(gameSession.id);
                return;
            }

            // Simple Pong AI: randomly move up or down (simulate ball tracking)
            const moveDirection = pongDirections[Math.random() > 0.5 ? 0 : 1] as 'up' | 'down';
            const moveMessage = {
                gameId: gameSession.id,
                direction: moveDirection,
                timestamp: Date.now()
            };

            console.log(`🤖 Pong Bot ${botId} moving ${moveDirection}`);
            this.handlePlayerMove(botId, moveMessage);
        }, 1500); // Bot moves every 1.5 seconds for responsive Pong gameplay

        // Store the interval in both the game session and our central tracking
        gameSession.botInterval = botInterval;
        this.botIntervals.set(gameSession.id, botInterval);
    }

    /**
     * Initiates an active game session when all players are ready.
     * Updates game status and notifies all participants that the game has started.
     *
     * @private
     * @param {string} gameId - The unique identifier of the game session to start.
     */
    private startGame(gameId: string) {
        const gameSession = this.gameSessions.get(gameId);
        if (gameSession) {
            gameSession.status = 'active';
            gameSession.startedAt = new Date();

            this.notifyPlayers(gameSession.players, {
                type: 'game_start',
                payload: { gameId, startedAt: gameSession.startedAt }
            });
        }
    }

    /**
     * Registers a new WebSocket connection for a player.
     *
     * @param {string} userId - The unique identifier for the player.
     * @param {any} connection - The WebSocket connection object.
     */
    addConnection(userId: string, connection: any) {
      this.activeConnections.set(userId, connection);
    }

    /**
     * Removes a player's WebSocket connection and cleans up their game state.
     * Removes from matchmaking queue and handles game disconnection.
     *
     * @param {string} userId - The unique identifier for the disconnecting player.
     */
    removeConnection(userId: string) {
        this.activeConnections.delete(userId);
        this.leaveMatchmaking(userId);

        // Remove from any active games
        this.gameSessions.forEach((session, gameId) => {
            if (session.players.includes(userId)) {
              this.handlePlayerDisconnect(userId);
          }
        });
    }

    /**
     * Cleans up all service resources and stops background processes.
     * Clears intervals, game sessions, and connection maps.
     */
    destroy() {
      if (this.matchmakingInterval) {
        clearInterval(this.matchmakingInterval);
      }

      // Clean up all bot intervals
      this.botIntervals.forEach((interval, gameId) => {
        console.log(`Cleaning up bot interval for game ${gameId}`);
        clearInterval(interval);
      });
      this.botIntervals.clear();

      // Clear all game sessions
      this.gameSessions.clear();

      // Clear all connections
      this.activeConnections.clear();
      this.botConnections.clear();
    }

    /**
     * Handles cleanup when a player disconnects from a game.
     * Ends the game session and stops any associated bot behavior.
     *
     * @private
     * @param {string} playerId - The ID of the player who disconnected.
     * @returns {string | null} The ID of the ended game session, or null if no game was affected.
     */
    private handlePlayerDisconnect(playerId: string): string | null {
        console.log(`Player ${playerId} disconnected`);

        // Remove from active connections
        this.activeConnections.delete(playerId);

        // Remove from matchmaking queue if present
        const queueIndex = this.matchmakingQueue.indexOf(playerId);
        if (queueIndex > -1) {
            this.matchmakingQueue.splice(queueIndex, 1);
            console.log(`Removed ${playerId} from matchmaking queue`);
        }

        // Find game session this player was in
        let gameToEnd: string | null = null;

        for (const [gameId, gameSession] of this.gameSessions.entries()) {
            if (gameSession.players.includes(playerId)) {
                console.log(`Ending game ${gameId} due to player disconnect`);

                // Clear bot interval from both locations
                if (gameSession.botInterval) {
                    clearInterval(gameSession.botInterval);
                    gameSession.botInterval = null;
                    console.log(`Cleared bot interval from game session ${gameId}`);
                }
                if (this.botIntervals.has(gameId)) {
                    clearInterval(this.botIntervals.get(gameId));
                    this.botIntervals.delete(gameId);
                    console.log(`Cleared bot interval from central tracking ${gameId}`);
                }

                // Clean up bot connections for this game
                for (const playerId of gameSession.players) {
                    if (playerId.startsWith('bot-')) {
                        this.botConnections.delete(playerId);
                        console.log(`Cleaned up bot ${playerId} from game ${gameId}`);
                    }
                }

                // Remove the game session
                this.gameSessions.delete(gameId);
                gameToEnd = gameId;
                break;
            }
        }

        // Clean up bot connection if the disconnecting player was a bot
        if (this.botConnections.has(playerId)) {
            this.botConnections.delete(playerId);
            console.log(`Cleaned up disconnecting bot ${playerId}`);
        }

        return gameToEnd;
    }

    /**
     * Retrieves current service statistics.
     *
     * @returns {{activeConnections: number, gameSessions: number, matchmakingQueue: number}} Current stats object.
     */
    getStats() {
        return {
            activeConnections: this.activeConnections.size,
            gameSessions: this.gameSessions.size,
            matchmakingQueue: this.matchmakingQueue.length
        };
    }

    /**
     * Sends a message to a specific player via their WebSocket connection.
     *
     * @param {string} userId - The ID of the target player.
     * @param {any} message - The message object to send (will be JSON stringified).
     */
    notifyPlayer(userId: string, message: any) {
        const connection = this.activeConnections.get(userId);
        if (connection?.readyState === 1) { // 1 = OPEN
          console.log(`✅ Sending ${message.type} to ${userId}`);
          connection.send(JSON.stringify(message));
        } else {
          console.log(`❌ No active connection for ${userId} (connection state: ${connection?.readyState || 'none'})`);
        }
    }

    /**
     * Sends a message to multiple players simultaneously.
     *
     * @param {string[]} userIds - Array of player IDs to notify.
     * @param {any} message - The message object to send to all players.
     */
    notifyPlayers(userIds: string[], message: any) {
        userIds.forEach(userId => this.notifyPlayer(userId, message));
    }
}

export const gameService = new GameServices();

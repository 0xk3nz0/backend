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


export class GameServices {
    private activeConnections = new Map<string, any>();
    private gameSessions = new Map<string, any>();
    private matchmakingQueue: string[] = [];

    private botConnections = new Map<string, any>(); // botId -> mock connection
    private matchmakingJoinTimes = new Map<string, number>();






    // ✅ ADD MATCHMAKING INTERVAL
    private matchmakingInterval: NodeJS.Timeout | null = null;

    constructor() {
      // ✅ START PERIODIC MATCHMAKING CHECKS
      this.startMatchmakingProcessor();
    }

    // ✅ ADD METHOD TO PERIODICALLY CHECK MATCHMAKING
    private startMatchmakingProcessor() {
      this.matchmakingInterval = setInterval(() => {
        this.tryMatchPlayers('classic'); // Check for classic games
        // You can add other game types here
      }, 2000); // Check every 2 seconds
    }






    async handlePlayerMove(userId: string, payload: PlayerMoveInput) {
        console.log(`🎮 ${userId.startsWith('bot-') ? '🤖 Bot' : 'Player'} ${userId} moved:`, payload);

        const gameSession = this.gameSessions.get(payload.gameId);
        if (gameSession) {
          // Forward movement to other players in the same game
          gameSession.players.forEach((playerId: string) => {
            if (playerId !== userId) {
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

    async handleGameJoin(userId: string, payload: GameJoinInput) {
      console.log(`Player ${userId} wants to join game:`, payload);
      if (payload.gameId) {
        return await this.joinExistingGame(userId, payload.gameId);
      } else {
        return await this.joinMatchmaking(userId, payload.gameType);
      }
    }

    async handleMatchmaking(userId: string, payload: MatchmakingInput) {
      console.log(`🔍 Player ${userId} matchmaking:`, payload);

      if (payload.action === 'join') {
        return await this.joinMatchmaking(userId, payload.gameType);
      } else {
        return await this.leaveMatchmaking(userId);
      }
    }

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

    private async leaveMatchmaking(userId: string) {
        this.matchmakingQueue = this.matchmakingQueue.filter(id => id !== userId);
        return { success: true, message: 'Left matchmaking' };
    }

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
    private async createGameSession(player1Id: string, player2Id: string, gameType: string) {
        const isPlayer2Bot = player2Id.startsWith('bot-');

        const gameSession = {
            id: `game-${Date.now()}`,
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
            this.startBotBehavior(player2Id, gameSession.id);
        } else {
          this.notifyPlayer(player2Id, {
              type: 'game_matched',
              payload: { ...gameSession, yourPlayerId: player2Id, opponentIsBot: false }
          });
        }

        return gameSession;
    }

    private startBotBehavior(botId: string, gameId: string) {
        console.log(`🤖 Starting bot ${botId} for game ${gameId}`);

        // Simulate bot sending ready message after 1 second
        setTimeout(() => {
          this.handleGameReady(botId, { gameId });
        }, 1000);

        // Bot makes random movements every 2 seconds
        const botInterval = setInterval(() => {
          if (!this.gameSessions.has(gameId)) {
            clearInterval(botInterval);
            return;
          }

          const directions = ['up', 'down', 'left', 'right'] as const;

          const randomDirection = directions[Math.floor(Math.random() * directions.length)] as typeof directions[number];

          // Send bot movement
          this.handlePlayerMove(botId, {
            direction: randomDirection,
            gameId: gameId,
            timestamp: Date.now()
          });

      }, 2000); // Move every 2 seconds

      // Store interval for cleanup
      const gameSession = this.gameSessions.get(gameId);
      if (gameSession) {
        gameSession.botInterval = botInterval;
      }
  }


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
    addConnection(userId: string, connection: any) {
      this.activeConnections.set(userId, connection);
    }

    removeConnection(userId: string) {
        this.activeConnections.delete(userId);
        this.leaveMatchmaking(userId);

        // Remove from any active games
        this.gameSessions.forEach((session, gameId) => {
            if (session.players.includes(userId)) {
              this.handlePlayerDisconnect(gameId, userId);
          }
        });
    }

    destroy() {
      if (this.matchmakingInterval) {
        clearInterval(this.matchmakingInterval);
    }
  }

     private handlePlayerDisconnect(gameId: string, userId: string) {
      const gameSession = this.gameSessions.get(gameId);
      if (gameSession) {
        // Clean up bot interval if this was a bot game
        if (gameSession.botInterval) {
          clearInterval(gameSession.botInterval);
        }

        this.notifyPlayers(gameSession.players.filter((id: string) => id !== userId), {
          type: 'player_disconnected',
          payload: { gameId, userId }
        });

        // Clean up empty games
        gameSession.players = gameSession.players.filter((id: string) => id !== userId);
        if (gameSession.players.length === 0) {
          this.gameSessions.delete(gameId);
        }
      }
    }

    getStats() {
        return {
            activeConnections: this.activeConnections.size,
            gameSessions: this.gameSessions.size,
            matchmakingQueue: this.matchmakingQueue.length
        };
    }

    notifyPlayer(userId: string, message: any) {
        const connection = this.activeConnections.get(userId);
        if (connection?.readyState === 1) { // 1 = OPEN
          connection.send(JSON.stringify(message));
        }
    }

    notifyPlayers(userIds: string[], message: any) {
        userIds.forEach(userId => this.notifyPlayer(userId, message));
    }
}

export const gameService = new GameServices();

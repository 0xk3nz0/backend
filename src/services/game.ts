import { success } from "zod";
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
  gameId: z.string().uuid()
});

export type PlayerMoveInput = z.infer<typeof playerMoveSchema>;
export type GameJoinInput = z.infer<typeof gameJoinSchema>;
export type MatchmakingInput = z.infer<typeof matchmakingSchema>;
export type GameReadyInput = z.infer<typeof gameReadySchema>;


export class GameServices {
    private activeConnections = new Map<string, any>();
    private gameSessions = new Map<string, any>();
    private matchmakingQueue: string[] = [];

    async handlePlayerMove(userId: string, payload: PlayerMoveInput) {
        console.log(`Player ${userId} moved:`, payload);

        const gameSession = this.gameSessions.get(payload.gameId);
        if (gameSession) {
            gameSession.players.forEach((playerId: string) => {
                if (playerId !== userId) {
                    this.notifyPlayer(playerId, {
                        type: 'player moved',
                        payload: { userId, ...payload }
                    });
                }
            });
        }
        return { success: true, message: ' movement processed'};
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
        }
    }
    private async createGameSession(player1Id: string, player2Id: string, gameType: string) {
        const gameSession = {
            id: `game-${Date.now()}`,
            players: [player1Id, player2Id],
            gameType,
            status: 'starting' as const,
            createdAt: new Date()
        };

        this.gameSessions.set(gameSession.id, gameSession);

        // Notify both players
        this.notifyPlayer(player1Id, {
            type: 'game_matched',
            payload: { ...gameSession, yourPlayerId: player1Id }
        });
        this.notifyPlayer(player2Id, {
            type: 'game_matched',
            payload: { ...gameSession, yourPlayerId: player2Id }
        });

        return gameSession;
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

    private handlePlayerDisconnect(gameId: string, userId: string) {
        const gameSession = this.gameSessions.get(gameId);
        if (gameSession) {
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

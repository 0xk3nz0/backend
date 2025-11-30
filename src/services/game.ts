import { string, success } from "zod";
import { prisma } from "../utils/prisma.js";
import { z } from 'zod';
import type { PlayerMoveInput, GameJoinInput, MatchmakingInput, GameReadyInput, TournamentCreateInput, TournamentJoinInput, TournamentActionInput, GameResultInput, ScoreUpdateInput, MatchEndInput } from '../schemas/game.js'

// export const playerMoveSchema = z.object({
//   direction: z.enum(['up', 'down', 'left', 'right']),
//   gameId: z.string().uuid(),
//   timestamp: z.number()
// });

// export const gameJoinSchema = z.object({
//   gameId: z.string().uuid().optional(),
//   gameType: z.enum(['classic', 'tournament']).default('classic')
// });

// export const matchmakingSchema = z.object({
//   action: z.enum(['join', 'leave']),
//   gameType: z.enum(['classic', 'tournament']).default('classic')
// });

// export const gameReadySchema = z.object({
//   gameId: z.string().min(1)
// });

// export type PlayerMoveInput = z.infer<typeof playerMoveSchema>;
// export type GameJoinInput = z.infer<typeof gameJoinSchema>;
// export type MatchmakingInput = z.infer<typeof matchmakingSchema>;
// export type GameReadyInput = z.infer<typeof gameReadySchema>;

// Tournament interfaces
interface TournamentPlayer {
    id: string;
    name: string;
    joinedAt: Date;
    isEliminated: boolean;
}

interface TournamentMatch {
    id: string;
    round: number;
    player1: TournamentPlayer | null;
    player2: TournamentPlayer | null;
    winner: TournamentPlayer | null;
    gameId: string | null;
    status: 'waiting' | 'in_progress' | 'completed';
}

interface Tournament {
    id: string;
    name: string;
    creatorId: string;
    description?: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
    status: 'waiting_for_players' | 'in_progress' | 'completed';
    players: TournamentPlayer[];
    bracket: TournamentMatch[];
    currentRound: number;
    winnerId: string | null;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

/**
 * Real-time multiplayer Pong game service with tournament support.
 * Manages WebSocket connections, matchmaking, bot opponents, game sessions, and tournaments.
 * Handles player movements, game state synchronization, bot AI behavior, and tournament brackets.
 */
export class GameServices {
    private activeConnections = new Map<string, any>();
    private gameSessions = new Map<string, any>();
    private matchmakingQueue: string[] = [];
    private botConnections = new Map<string, any>();
    private matchmakingJoinTimes = new Map<string, number>();
    private botIntervals = new Map<string, NodeJS.Timeout>();
    private matchmakingInterval: NodeJS.Timeout | null = null;

    // Tournament system
    private tournaments = new Map<string, Tournament>();
    private playerTournaments = new Map<string, string>(); // playerId -> tournamentId

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
    /**
     * Handles real-time EXP score updates from the frontend during an active match.
     * Stores the current EXP for each player and broadcasts updates to both players.
     *
     * @param {string} userId - The ID of the player updating their score.
     * @param {ScoreUpdateInput} payload - Validated score update containing game ID and current EXP.
     * @returns {Promise<{success: boolean, message: string}>} Result of the score update.
     */
    async handleScoreUpdate(userId: string, payload: any) {
        console.log(`📊 Score update from ${userId}: EXP = ${payload.currentExp}`);

        const gameSession = this.gameSessions.get(payload.gameId);
        if (!gameSession) {
            return { success: false, message: 'Game session not found' };
        }

        // Update the player's current EXP score
        gameSession.expScores[userId] = payload.currentExp;

        // Broadcast the updated scores to both players for real-time sync
        this.notifyPlayers(gameSession.players, {
            type: 'score_update',
            payload: {
                gameId: payload.gameId,
                scores: gameSession.expScores,
                timestamp: payload.timestamp
            }
        });

        return { success: true, message: 'Score updated' };
    }

    /**
     * Handles the match end event when the 1-minute timer expires.
     * Compares final EXP scores to determine winner and processes results.
     *
     * @param {string} initiatorId - The player ID that triggered the match end (usually frontend).
     * @param {MatchEndInput} payload - Final game state with both players' EXP scores.
     * @returns {Promise<{success: boolean, winnerId: string, finalScores: any}>} Match result with winner determination.
     */
    async handleMatchEnd(initiatorId: string, payload: any) {
        console.log(`⏰ Match end signal from ${initiatorId}:`, payload);

        const gameSession = this.gameSessions.get(payload.gameId);
        if (!gameSession) {
            return { success: false, message: 'Game session not found' };
        }

        // Determine winner based on final EXP scores
        const player1Id = payload.player1Id;
        const player2Id = payload.player2Id;
        const player1Exp = payload.player1Exp;
        const player2Exp = payload.player2Exp;

        const winnerId = player1Exp > player2Exp ? player1Id : player2Id === player1Exp ? null : player2Id;
        const isTie = player1Exp === player2Exp;

        console.log(`🏆 Match Result: ${player1Id} (${player1Exp} EXP) vs ${player2Id} (${player2Exp} EXP)`);
        console.log(`🎯 Winner: ${isTie ? 'TIE' : winnerId}`);

        // Update game session with final results
        gameSession.status = 'completed';
        gameSession.winnerId = isTie ? null : winnerId;
        gameSession.finalScores = {
            [player1Id]: player1Exp,
            [player2Id]: player2Exp
        };
        gameSession.endedAt = new Date();
        gameSession.matchDurationMs = payload.matchDurationMs || 60000;

        // Clear the match timer
        if (gameSession.matchTimer) {
            clearTimeout(gameSession.matchTimer);
            gameSession.matchTimer = null;
        }

        // Notify both players of the match result
        this.notifyPlayers(gameSession.players, {
            type: 'match_ended',
            payload: {
                gameId: payload.gameId,
                winnerId: winnerId,
                isTie: isTie,
                finalScores: gameSession.finalScores,
                matchDurationMs: gameSession.matchDurationMs
            }
        });

        // For tournament games, advance the winner
        if (gameSession.tournamentId && winnerId) {
            this.advanceTournamentPlayer(gameSession.tournamentId, winnerId);
        }

        return {
            success: true,
            winnerId: winnerId,
            isTie: isTie,
            finalScores: gameSession.finalScores
        };
    }

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
            isBotGame: isPlayer2Bot,
            // EXP tracking for the 1-minute match
            expScores: {
                [player1Id]: 0,
                [player2Id]: 0
            },
            matchStartTime: null as number | null,
            matchTimer: null as NodeJS.Timeout | null,
            MATCH_DURATION_MS: 60000 // 1 minute
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
     * Starts the 1-minute match timer and notifies all participants.
     *
     * @private
     * @param {string} gameId - The unique identifier of the game session to start.
     */
    private startGame(gameId: string) {
        const gameSession = this.gameSessions.get(gameId);
        if (gameSession) {
            gameSession.status = 'active';
            gameSession.startedAt = new Date();
            gameSession.matchStartTime = Date.now();

            console.log(`🎮 Game ${gameId} started. 1-minute timer begins...`);

            // Notify both players that the game has started
            this.notifyPlayers(gameSession.players, {
                type: 'game_start',
                payload: {
                    gameId,
                    startedAt: gameSession.startedAt,
                    matchDurationMs: gameSession.MATCH_DURATION_MS
                }
            });

            // Set up the 1-minute match timer
            gameSession.matchTimer = setTimeout(() => {
                console.log(`⏰ 1-minute timer expired for game ${gameId}. Waiting for match end signal...`);
                // Frontend will send the final scores when timer expires
            }, gameSession.MATCH_DURATION_MS);
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

        // Handle tournament disconnection
        this.handleTournamentDisconnect(userId);

        // Remove from any active games
        this.gameSessions.forEach((session, gameId) => {
            if (session.players.includes(userId)) {
              this.handlePlayerDisconnect(userId);
          }
        });
    }

    /**
     * Handles tournament-related actions (create, join, leave, start, get_info).
     *
     * @param {string} userId - The ID of the player making the request.
     * @param {TournamentActionInput} payload - The tournament action data.
     * @returns {Promise<any>} Result of the tournament action.
     */
    async handleTournamentAction(userId: string, payload: TournamentActionInput) {
        console.log(`🏆 Tournament action from ${userId}:`, payload);


        switch (payload.action) {
            case 'create':
                if (!payload.tournamentData) {
                    throw new Error('Tournament data required for create action');
                }
                return await this.createTournament(userId, payload.tournamentData);

            case 'join':
                if (!payload.tournamentId) {
                    throw new Error('Tournament ID required for join action');
                }
                return await this.joinTournament(userId, payload.tournamentId, payload.tournamentData?.password);

            case 'leave':
                if (!payload.tournamentId) {
                    throw new Error('Tournament ID required for leave action');
                }
                return await this.leaveTournament(userId, payload.tournamentId);

            case 'start':
                if (!payload.tournamentId) {
                    throw new Error('Tournament ID required for start action');
                }
                return await this.startTournament(userId, payload.tournamentId);

            case 'get_info':
                if (!payload.tournamentId) {
                    throw new Error('Tournament ID required for get_info action');
                }
                return this.getTournamentInfo(payload.tournamentId);

            default:
                throw new Error(`Unknown tournament action: ${payload.action}`);
        }
    }

    /**
     * Handles game result submission for tournament matches.
     *
     * @param {string} userId - The ID of the player submitting the result.
     * @param {GameResultInput} payload - The game result data.
     * @returns {Promise<any>} Result of processing the game result.
     */
    async handleGameResult(userId: string, payload: GameResultInput) {
        console.log(`🎯 Game result from ${userId}:`, payload);

        const gameSession = this.gameSessions.get(payload.gameId);
        if (!gameSession) {
            throw new Error('Game session not found');
        }

        // Check if this is a tournament game
        if (gameSession.tournamentId) {
            return await this.processTournamentGameResult(gameSession.tournamentId, payload);
        }

        return { success: true, message: 'Game result recorded' };
    }

    /**
     * Creates a new tournament.
     *
     * @private
     * @param {string} creatorId - The ID of the tournament creator.
     * @param {TournamentCreateInput} tournamentData - Tournament configuration.
     * @returns {Promise<any>} The created tournament information.
     */
    private async createTournament(creatorId: string, tournamentData: TournamentCreateInput) {
        // Validate max players is power of 2
        if (!this.isPowerOfTwo(tournamentData.maxPlayers)) {
            throw new Error('Max players must be a power of 2 (4, 8, 16, 32, 64)');
        }

        const tournament: Tournament = {
            id: `tournament-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: tournamentData.name,
            creatorId,
            maxPlayers: tournamentData.maxPlayers,
            isPrivate: tournamentData.isPrivate,
            status: 'waiting_for_players',
            players: [],
            bracket: [],
            currentRound: 1,
            winnerId: null,
            createdAt: new Date(),
            ...(tournamentData.description && { description: tournamentData.description }),
            ...(tournamentData.password && { password: tournamentData.password })
        };

        this.tournaments.set(tournament.id, tournament);

        // Automatically join the creator
        await this.joinTournament(creatorId, tournament.id);

        console.log(`🏆 Tournament "${tournament.name}" created with ID: ${tournament.id}`);

        return {
            success: true,
            tournament: this.sanitizeTournamentForClient(tournament)
        };
    }

    /**
     * Allows a player to join a tournament.
     *
     * @private
     * @param {string} playerId - The ID of the player joining.
     * @param {string} tournamentId - The ID of the tournament to join.
     * @param {string} password - Optional password for private tournaments.
     * @returns {Promise<any>} Result of the join operation.
     */
    private async joinTournament(playerId: string, tournamentId: string, password?: string) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        // Check if player is already in a tournament
        if (this.playerTournaments.has(playerId)) {
            throw new Error('Player is already in a tournament');
        }

        // Check password for private tournaments
        if (tournament.isPrivate && tournament.password !== password) {
            throw new Error('Invalid password');
        }

        // Check if tournament is full
        if (tournament.players.length >= tournament.maxPlayers) {
            throw new Error('Tournament is full');
        }

        // Check if tournament has already started
        if (tournament.status !== 'waiting_for_players') {
            throw new Error('Tournament has already started');
        }

        // Check if player is already in the tournament
        if (tournament.players.some(p => p.id === playerId)) {
            throw new Error('Player is already in this tournament');
        }

        // Add player to tournament
        const player: TournamentPlayer = {
            id: playerId,
            name: `Player ${playerId}`, // You might want to get this from user data
            joinedAt: new Date(),
            isEliminated: false
        };

        tournament.players.push(player);
        this.playerTournaments.set(playerId, tournamentId);

        // Notify all players in the tournament
        this.notifyTournamentPlayers(tournamentId, {
            type: 'tournament_player_joined',
            payload: {
                tournamentId,
                player,
                totalPlayers: tournament.players.length,
                maxPlayers: tournament.maxPlayers
            }
        });

        console.log(`🏆 Player ${playerId} joined tournament ${tournamentId} (${tournament.players.length}/${tournament.maxPlayers})`);

        return {
            success: true,
            tournament: this.sanitizeTournamentForClient(tournament),
            message: `Joined tournament "${tournament.name}"`
        };
    }

    /**
     * Removes a player from a tournament.
     *
     * @private
     * @param {string} playerId - The ID of the player leaving.
     * @param {string} tournamentId - The ID of the tournament to leave.
     * @returns {Promise<any>} Result of the leave operation.
     */
    private async leaveTournament(playerId: string, tournamentId: string) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        const playerIndex = tournament.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) {
            throw new Error('Player not in this tournament');
        }

        // Check if tournament has started
        if (tournament.status === 'in_progress') {
            // Mark player as eliminated instead of removing
            const player = tournament.players[playerIndex];
            if (player) {
                player.isEliminated = true;
            }
            this.playerTournaments.delete(playerId);

            this.notifyTournamentPlayers(tournamentId, {
                type: 'tournament_player_eliminated',
                payload: {
                    tournamentId,
                    playerId,
                    reason: 'disconnected'
                }
            });

            return { success: true, message: 'Marked as eliminated due to leaving during tournament' };
        }

        // Remove player if tournament hasn't started
        tournament.players.splice(playerIndex, 1);
        this.playerTournaments.delete(playerId);

        // If creator left and tournament is empty, delete tournament
        if (tournament.creatorId === playerId && tournament.players.length === 0) {
            this.tournaments.delete(tournamentId);
            return { success: true, message: 'Left tournament (tournament deleted)' };
        }

        // If creator left but tournament has other players, transfer ownership
        if (tournament.creatorId === playerId && tournament.players.length > 0) {
            const newCreator = tournament.players[0];
            if (newCreator) {
                tournament.creatorId = newCreator.id;
            }
        }

        this.notifyTournamentPlayers(tournamentId, {
            type: 'tournament_player_left',
            payload: {
                tournamentId,
                playerId,
                totalPlayers: tournament.players.length,
                maxPlayers: tournament.maxPlayers
            }
        });

        return { success: true, message: 'Left tournament' };
    }

    /**
     * Starts a tournament if conditions are met.
     *
     * @private
     * @param {string} playerId - The ID of the player requesting to start (must be creator).
     * @param {string} tournamentId - The ID of the tournament to start.
     * @returns {Promise<any>} Result of the start operation.
     */
    private async startTournament(playerId: string, tournamentId: string) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        // Check if player is the creator
        if (tournament.creatorId !== playerId) {
            throw new Error('Only the tournament creator can start the tournament');
        }

        // Check if tournament has already started
        if (tournament.status !== 'waiting_for_players') {
            throw new Error('Tournament has already started or completed');
        }

        // Check minimum players (at least 4)
        if (tournament.players.length < 4) {
            throw new Error('Tournament needs at least 4 players to start');
        }

        // Check if player count is power of 2
        if (!this.isPowerOfTwo(tournament.players.length)) {
            throw new Error('Player count must be a power of 2 to create a proper bracket');
        }

        // Generate tournament bracket
        this.generateTournamentBracket(tournament);

        tournament.status = 'in_progress';
        tournament.startedAt = new Date();

        // Start first round matches
        await this.startTournamentRound(tournamentId, 1);

        this.notifyTournamentPlayers(tournamentId, {
            type: 'tournament_started',
            payload: {
                tournamentId,
                tournament: this.sanitizeTournamentForClient(tournament)
            }
        });

        console.log(`🏆 Tournament ${tournamentId} started with ${tournament.players.length} players`);

        return {
            success: true,
            tournament: this.sanitizeTournamentForClient(tournament),
            message: 'Tournament started!'
        };
    }

    /**
     * Gets tournament information.
     *
     * @private
     * @param {string} tournamentId - The ID of the tournament.
     * @returns {any} Tournament information.
     */
    private getTournamentInfo(tournamentId: string) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        return {
            success: true,
            tournament: this.sanitizeTournamentForClient(tournament)
        };
    }

    /**
     * Generates a tournament bracket with proper seeding.
     *
     * @private
     * @param {Tournament} tournament - The tournament to generate bracket for.
     */
    private generateTournamentBracket(tournament: Tournament) {
        const players = [...tournament.players];
        const totalRounds = Math.log2(players.length);

        // Shuffle players for random seeding
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const playerI = players[i];
            const playerJ = players[j];
            if (playerI && playerJ) {
                [players[i], players[j]] = [playerJ, playerI];
            }
        }

        // Generate first round matches
        for (let i = 0; i < players.length; i += 2) {
            const player1 = players[i];
            const player2 = players[i + 1];

            const match: TournamentMatch = {
                id: `match-${tournament.id}-1-${i / 2 + 1}`,
                round: 1,
                player1: player1 || null,
                player2: player2 || null,
                winner: null,
                gameId: null,
                status: 'waiting'
            };
            tournament.bracket.push(match);
        }

        // Generate subsequent rounds (empty matches to be filled by winners)
        let matchesInRound = players.length / 2;
        for (let round = 2; round <= totalRounds; round++) {
            matchesInRound = matchesInRound / 2;
            for (let i = 0; i < matchesInRound; i++) {
                const match: TournamentMatch = {
                    id: `match-${tournament.id}-${round}-${i + 1}`,
                    round,
                    player1: null,
                    player2: null,
                    winner: null,
                    gameId: null,
                    status: 'waiting'
                };
                tournament.bracket.push(match);
            }
        }
    }

    /**
     * Starts a tournament round by creating game sessions for all matches.
     *
     * @private
     * @param {string} tournamentId - The tournament ID.
     * @param {number} round - The round number to start.
     */
    private async startTournamentRound(tournamentId: string, round: number) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return;

        const roundMatches = tournament.bracket.filter(m => m.round === round && m.status === 'waiting');

        for (const match of roundMatches) {
            if (match.player1 && match.player2) {
                // Create game session for this match
                const gameSession = await this.createTournamentGameSession(
                    match.player1.id,
                    match.player2.id,
                    tournamentId,
                    match.id
                );

                match.gameId = gameSession.id;
                match.status = 'in_progress';

                console.log(`🎮 Started tournament match: ${match.player1.name} vs ${match.player2.name}`);
            }
        }

        this.notifyTournamentPlayers(tournamentId, {
            type: 'tournament_round_started',
            payload: {
                tournamentId,
                round,
                matches: roundMatches.map(m => this.sanitizeMatchForClient(m))
            }
        });
    }

    /**
     * Creates a game session specifically for tournament matches.
     *
     * @private
     * @param {string} player1Id - First player ID.
     * @param {string} player2Id - Second player ID.
     * @param {string} tournamentId - Tournament ID.
     * @param {string} matchId - Tournament match ID.
     * @returns {Promise<any>} Created game session.
     */
    private async createTournamentGameSession(player1Id: string, player2Id: string, tournamentId: string, matchId: string) {
        const gameSession = {
            id: `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            players: [player1Id, player2Id],
            gameType: 'tournament',
            status: 'starting' as const,
            createdAt: new Date(),
            tournamentId,
            matchId,
            isBotGame: false,
            readyPlayers: new Set([player1Id, player2Id]) // Tournament players are automatically ready
        };

        this.gameSessions.set(gameSession.id, gameSession);

        // Notify both players that match is ready
        this.notifyPlayer(player1Id, {
            type: 'tournament_match_ready',
            payload: { ...gameSession, yourPlayerId: player1Id }
        });

        this.notifyPlayer(player2Id, {
            type: 'tournament_match_ready',
            payload: { ...gameSession, yourPlayerId: player2Id }
        });

        // Auto-start tournament games after a brief delay to allow UI updates
        setTimeout(() => {
            console.log(`🚀 Auto-starting tournament game: ${gameSession.id}`);
            this.startGame(gameSession.id);
        }, 2000); // 2 second delay for players to see the match ready screen

        return gameSession;
    }

    /**
     * Processes game results for tournament matches.
     *
     * @private
     * @param {string} tournamentId - Tournament ID.
     * @param {GameResultInput} result - Game result data.
     * @returns {Promise<any>} Result processing outcome.
     */
    private async processTournamentGameResult(tournamentId: string, result: GameResultInput) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        const gameSession = this.gameSessions.get(result.gameId);
        if (!gameSession || !gameSession.matchId) {
            throw new Error('Tournament match not found');
        }

        const match = tournament.bracket.find(m => m.id === gameSession.matchId);
        if (!match) {
            throw new Error('Tournament match not found in bracket');
        }

        // Find winner player object
        const winnerPlayer = tournament.players.find(p => p.id === result.winnerId);
        if (!winnerPlayer) {
            throw new Error('Winner not found in tournament');
        }

        // Update match result
        match.winner = winnerPlayer;
        match.status = 'completed';

        // Mark loser as eliminated
        const loserId = gameSession.players.find((id: string) => id !== result.winnerId);
        if (loserId) {
            const loserPlayer = tournament.players.find(p => p.id === loserId);
            if (loserPlayer) {
                loserPlayer.isEliminated = true;
            }
        }

        console.log(`🏆 Tournament match completed: ${winnerPlayer.name} won!`);

        // Check if round is complete
        const currentRoundMatches = tournament.bracket.filter(m => m.round === tournament.currentRound);
        const completedMatches = currentRoundMatches.filter(m => m.status === 'completed');

        if (completedMatches.length === currentRoundMatches.length) {
            // Round completed, advance to next round or end tournament
            await this.advanceTournamentRound(tournamentId);
        }

        this.notifyTournamentPlayers(tournamentId, {
            type: 'tournament_match_completed',
            payload: {
                tournamentId,
                matchId: match.id,
                winner: winnerPlayer,
                match: this.sanitizeMatchForClient(match)
            }
        });

        return { success: true, message: 'Tournament match result processed' };
    }

    /**
     * Advances tournament to the next round or completes it.
     *
     * @private
     * @param {string} tournamentId - Tournament ID.
     */
    private async advanceTournamentRound(tournamentId: string) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return;

        const currentRoundMatches = tournament.bracket.filter(m => m.round === tournament.currentRound);
        const winners = currentRoundMatches.map(m => m.winner).filter(Boolean);

        // Check if this was the final
        if (winners.length === 1) {
            // Tournament completed
            tournament.status = 'completed';
            tournament.winnerId = winners[0]!.id;
            tournament.completedAt = new Date();

            // Clean up player tournament mapping
            tournament.players.forEach(player => {
                this.playerTournaments.delete(player.id);
            });

            this.notifyTournamentPlayers(tournamentId, {
                type: 'tournament_completed',
                payload: {
                    tournamentId,
                    winner: winners[0],
                    tournament: this.sanitizeTournamentForClient(tournament)
                }
            });

            console.log(`🏆 Tournament ${tournamentId} completed! Winner: ${winners[0]!.name}`);
            return;
        }

        // Advance to next round
        tournament.currentRound++;
        const nextRoundMatches = tournament.bracket.filter(m => m.round === tournament.currentRound);

        // Pair up winners for next round
        for (let i = 0; i < winners.length; i += 2) {
            const match = nextRoundMatches[i / 2];
            if (match) {
                match.player1 = winners[i] || null;
                match.player2 = winners[i + 1] || null;
            }
        }

        // Start next round
        await this.startTournamentRound(tournamentId, tournament.currentRound);

        console.log(`🏆 Tournament ${tournamentId} advanced to round ${tournament.currentRound}`);
    }

    /**
     * Handles tournament-specific disconnection logic.
     *
     * @private
     * @param {string} playerId - The disconnecting player ID.
     */
    private handleTournamentDisconnect(playerId: string) {
        const tournamentId = this.playerTournaments.get(playerId);
        if (tournamentId) {
            // Handle based on tournament status
            const tournament = this.tournaments.get(tournamentId);
            if (tournament) {
                if (tournament.status === 'waiting_for_players') {
                    this.leaveTournament(playerId, tournamentId).catch(console.error);
                } else if (tournament.status === 'in_progress') {
                    // Mark as eliminated and forfeit any active matches
                    const player = tournament.players.find(p => p.id === playerId);
                    if (player) {
                        player.isEliminated = true;
                        // Handle any active matches this player is in
                        this.forfeitActiveMatches(playerId, tournamentId);
                    }
                }
            }
        }
    }

    /**
     * Forfeits any active matches for a disconnected player.
     *
     * @private
     * @param {string} playerId - The disconnected player ID.
     * @param {string} tournamentId - The tournament ID.
     */
    private forfeitActiveMatches(playerId: string, tournamentId: string) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return;

        // Find active matches with this player
        const activeMatches = tournament.bracket.filter(m =>
            m.status === 'in_progress' &&
            (m.player1?.id === playerId || m.player2?.id === playerId)
        );

        for (const match of activeMatches) {
            // Determine winner (opponent)
            const winnerId = match.player1?.id === playerId ? match.player2?.id : match.player1?.id;
            if (winnerId) {
                // Auto-complete match with forfeit
                this.handleGameResult(winnerId, {
                    gameId: match.gameId!,
                    winnerId: winnerId
                }).catch(console.error);
            }
        }
    }

    /**
     * Gets all available tournaments.
     *
     * @returns {any[]} Array of tournament information.
     */
    getAvailableTournaments() {
        const tournaments = Array.from(this.tournaments.values())
            .filter(t => !t.isPrivate || t.status === 'waiting_for_players')
            .map(t => this.sanitizeTournamentForClient(t));

        return { success: true, tournaments };
    }

    /**
     * Utility function to check if a number is a power of 2.
     *
     * @private
     * @param {number} n - Number to check.
     * @returns {boolean} True if power of 2.
     */
    private isPowerOfTwo(n: number): boolean {
        return n > 0 && (n & (n - 1)) === 0;
    }

    /**
     * Sanitizes tournament data for client consumption.
     *
     * @private
     * @param {Tournament} tournament - Tournament to sanitize.
     * @returns {any} Sanitized tournament data.
     */
    private sanitizeTournamentForClient(tournament: Tournament) {
        const { password, ...sanitized } = tournament;
        return sanitized;
    }

    /**
     * Sanitizes match data for client consumption.
     *
     * @private
     * @param {TournamentMatch} match - Match to sanitize.
     * @returns {any} Sanitized match data.
     */
    private sanitizeMatchForClient(match: TournamentMatch) {
        return {
            id: match.id,
            round: match.round,
            player1: match.player1 ? { id: match.player1.id, name: match.player1.name } : null,
            player2: match.player2 ? { id: match.player2.id, name: match.player2.name } : null,
            winner: match.winner ? { id: match.winner.id, name: match.winner.name } : null,
            status: match.status
        };
    }

    /**
     * Sends a message to all players in a tournament.
     *
     * @private
     * @param {string} tournamentId - Tournament ID.
     * @param {any} message - Message to send.
     */
    private notifyTournamentPlayers(tournamentId: string, message: any) {
        const tournament = this.tournaments.get(tournamentId);
        if (tournament) {
            tournament.players.forEach(player => {
                this.notifyPlayer(player.id, message);
            });
        }
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
     * Retrieves current service statistics including tournament data.
     *
     * @returns {{activeConnections: number, gameSessions: number, matchmakingQueue: number, tournaments: number, activeTournaments: number}} Current stats object.
     */
    getStats() {
        const activeTournaments = Array.from(this.tournaments.values())
            .filter(t => t.status === 'in_progress').length;

        return {
            activeConnections: this.activeConnections.size,
            gameSessions: this.gameSessions.size,
            matchmakingQueue: this.matchmakingQueue.length,
            tournaments: this.tournaments.size,
            activeTournaments
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

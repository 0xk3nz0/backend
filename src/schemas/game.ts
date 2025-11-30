import { z } from 'zod'

export const playerMoveSchema = z.object({
    direction: z.enum(['up', 'down', 'left', 'right']),
    gameId: z.string().min(1),
    timestamp: z.number()
});

export const gameJoinSchema = z.object({
    gameId: z.string().min(1).optional(),
    gameType: z.enum(['classic', 'tournament']).default('classic')
});

export const matchmakingSchema = z.object({
    action: z.enum(['join', 'leave']),
    gameType: z.enum(['classic', 'tournament']).default('classic')
});

export const gameReadySchema = z.object({
    gameId: z.string().min(1)
});

// Tournament-specific schemas
export const tournamentCreateSchema = z.object({
    name: z.string().min(1).max(100),
    maxPlayers: z.number().min(4).max(64).default(8), // Must be power of 2
    description: z.string().max(500).optional(),
    isPrivate: z.boolean().default(false),
    password: z.string().optional()
});

export const tournamentJoinSchema = z.object({
    tournamentId: z.string().min(1),
    password: z.string().optional()
});

export const tournamentActionSchema = z.object({
    action: z.enum(['create', 'join', 'leave', 'start', 'get_info']),
    tournamentId: z.string().optional(), // Required for join, leave, start, get_info
    tournamentData: tournamentCreateSchema.optional() // Required for create
});

export const gameResultSchema = z.object({
    gameId: z.string().min(1),
    winnerId: z.string().min(1),
    score: z.object({
        player1: z.number(),
        player2: z.number()
    }).optional()
});

/**
 * Schema for real-time EXP score updates during an active match.
 * Frontend sends continuous score updates as players accumulate EXP.
 */
export const scoreUpdateSchema = z.object({
    gameId: z.string().min(1),
    playerId: z.string().min(1),
    currentExp: z.number().min(0),
    timestamp: z.number()
});

/**
 * Schema for when a match ends after the 1-minute timer expires.
 * Compares final EXP scores to determine the winner.
 */
export const matchEndSchema = z.object({
    gameId: z.string().min(1),
    player1Id: z.string().min(1),
    player1Exp: z.number().min(0),
    player2Id: z.string().min(1),
    player2Exp: z.number().min(0),
    matchDurationMs: z.number().default(60000),
    timestamp: z.number()
});

export type PlayerMoveInput = z.infer<typeof playerMoveSchema>;
export type GameJoinInput = z.infer<typeof gameJoinSchema>;
export type MatchmakingInput = z.infer<typeof matchmakingSchema>;
export type GameReadyInput = z.infer<typeof gameReadySchema>;
export type TournamentCreateInput = z.infer<typeof tournamentCreateSchema>;
export type TournamentJoinInput = z.infer<typeof tournamentJoinSchema>;
export type TournamentActionInput = z.infer<typeof tournamentActionSchema>;
export type GameResultInput = z.infer<typeof gameResultSchema>;
export type ScoreUpdateInput = z.infer<typeof scoreUpdateSchema>;
export type MatchEndInput = z.infer<typeof matchEndSchema>;



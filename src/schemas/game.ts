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

export type PlayerMoveInput = z.infer<typeof playerMoveSchema>;
export type GameJoinInput = z.infer<typeof gameJoinSchema>;
export type MatchmakingInput = z.infer<typeof matchmakingSchema>;
export type GameReadyInput = z.infer<typeof gameReadySchema>;



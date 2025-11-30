import type { FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import type { User } from 'generated/prisma/index.js';
import { authenticateWebSocketToken } from '../middleware/chat.js';
import { gameService } from '../services/game.js';
import { playerMoveSchema, gameJoinSchema, matchmakingSchema, gameReadySchema, tournamentActionSchema, gameResultSchema, scoreUpdateSchema, matchEndSchema} from '../schemas/game.js';

type AuthenticatedWS = WebSocket & {
  // authenticatedUser?: User & { uid: string };
  authenticatedUser?:  { uid: string, id: string, name: string };

  userData?: { userId: string; gameSessions: Set<string> };
};

export async function handleGameWebSocket(connection: AuthenticatedWS, request: FastifyRequest) {
  // const token = extractTokenFromHeaders(request.headers);
  // if (!token) {
    // connection.close(1008, 'No token provided');
    // return;
  // }

  // try {
    // const authResult = await authenticateWebSocketToken(request.server, token);
    // if (!authResult.success) {
      // connection.close(1008, `Authentication failed: ${authResult.error}`);
      // return;
    // }
//
    // connection.authenticatedUser = authResult.user;
    // console.log(`🔗 User ${authResult.user.uid} connected to game WebSocket`);
//
  // } catch (error) {
    // connection.close(1008, 'Authentication error');
    // return;
  // }
//

  // test user to remove after

  const testUserId = 'frontend-user-' + Date.now();
    connection.authenticatedUser = {
        uid: testUserId,
        id: testUserId,
        name: 'Frontend Player'
    };


  const userId = connection.authenticatedUser!.uid;
  console.log(`🔗 Frontend user ${userId} connected`);

    //till here to remove



  gameService.addConnection(userId, connection);
  console.log(`🔗 User ${userId} connected. ${gameService.getStats().activeConnections} total connections`);

  connection.on('message', async (message: Buffer) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log(`📨 Received from ${userId}:`, parsedMessage);

      if (parsedMessage.type === 'ping') {
        connection.send(JSON.stringify({ type: 'pong', userId }));
        return;
      }

      switch (parsedMessage.type) {
        case 'player_move':
          const moveData = playerMoveSchema.parse(parsedMessage.payload);
          await gameService.handlePlayerMove(userId, moveData);
          break;

        case 'game_join':
          const joinData = gameJoinSchema.parse(parsedMessage.payload);
          const joinResult = await gameService.handleGameJoin(userId, joinData);
          connection.send(JSON.stringify({
            type: 'game_join_result',
            payload: joinResult
          }));
          break;

        case 'matchmaking':
          const matchmakingData = matchmakingSchema.parse(parsedMessage.payload);
          const matchmakingResult = await gameService.handleMatchmaking(userId, matchmakingData);
          connection.send(JSON.stringify({
            type: 'matchmaking_result',
            payload: matchmakingResult
          }));
          break;

        case 'game_ready':
          console.log('🔍 Validating game_ready with schema:', gameReadySchema);    //to remove after it's just for the debug
          const readyData = gameReadySchema.parse(parsedMessage.payload);
          await gameService.handleGameReady(userId, readyData);
          break;

        case 'tournament_action':
          const tournamentData = tournamentActionSchema.parse(parsedMessage.payload);
          const tournamentResult = await gameService.handleTournamentAction(userId, tournamentData);
          connection.send(JSON.stringify({
            type: 'tournament_action_result',
            payload: tournamentResult
          }));
          break;

        case 'game_result':
          const resultData = gameResultSchema.parse(parsedMessage.payload);
          const gameResultResponse = await gameService.handleGameResult(userId, resultData);
          connection.send(JSON.stringify({
            type: 'game_result_processed',
            payload: gameResultResponse
          }));
          break;

        case 'get_tournaments':
          const availableTournaments = gameService.getAvailableTournaments();
          connection.send(JSON.stringify({
            type: 'tournaments_list',
            payload: availableTournaments
          }));
          break;

        case 'score_update':
          const scoreData = scoreUpdateSchema.parse(parsedMessage.payload);
          const scoreUpdateResult = await gameService.handleScoreUpdate(userId, scoreData);
          // Acknowledge the score update
          connection.send(JSON.stringify({
            type: 'score_update_ack',
            payload: scoreUpdateResult
          }));
          break;

        case 'match_end':
          const matchEndData = matchEndSchema.parse(parsedMessage.payload);
          const matchEndResult = await gameService.handleMatchEnd(userId, matchEndData);
          // Send the match result back to the player
          connection.send(JSON.stringify({
            type: 'match_end_ack',
            payload: matchEndResult
          }));
          break;

        default:
          console.log(`❌ Unknown message type: ${parsedMessage.type}`);
          connection.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${parsedMessage.type}`
          }));
      }

    } catch (error) {
      console.log('❌ Error processing message:', error);
      connection.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format or validation failed'
      }));
    }
  });

  connection.on('close', () => {
    console.log(`🔌 User ${userId} disconnected`);
    gameService.removeConnection(userId);
    console.log(`📊 Stats:`, gameService.getStats());
  });

  connection.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to game server',
    userId: userId,
    stats: gameService.getStats()
  }));
}

function extractTokenFromHeaders(headers: any): string | null {
  const auth = headers.authorization;
  return auth?.startsWith('Bearer') ? auth.slice(7) : null;
}

export function getActiveConnectionsCount(): number {
  return gameService.getStats().activeConnections;
}

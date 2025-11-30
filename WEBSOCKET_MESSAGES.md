# WebSocket Message Reference Guide

## Backend → Frontend Messages

### Game Matched
Sent when two players are matched together.
```json
{
  "type": "game_matched",
  "payload": {
    "id": "game-1730816400000-abc123def",
    "players": ["player-123", "player-456"],
    "gameType": "classic",
    "status": "starting",
    "createdAt": "2025-11-25T12:00:00.000Z",
    "isBotGame": false,
    "yourPlayerId": "player-123",
    "opponentIsBot": false
  }
}
```

### Game Start
Sent when the game is ready to start (both players are ready).
```json
{
  "type": "game_start",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "startedAt": "2025-11-25T12:00:00.000Z",
    "matchDurationMs": 60000
  }
}
```

### Score Update (Broadcast)
Real-time score sync to both players during the match.
```json
{
  "type": "score_update",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "scores": {
      "player-123": 250,
      "player-456": 180
    },
    "timestamp": 1730816430000
  }
}
```

### Match Ended
Sent to both players when the 1-minute timer expires.
```json
{
  "type": "match_ended",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "winnerId": "player-123",
    "isTie": false,
    "finalScores": {
      "player-123": 450,
      "player-456": 320
    },
    "matchDurationMs": 60000
  }
}
```

### Player Moved
Notification of opponent's movement during the match.
```json
{
  "type": "player_moved",
  "payload": {
    "userId": "player-456",
    "direction": "up",
    "gameId": "game-1730816400000-abc123def",
    "timestamp": 1730816415000,
    "isBot": false
  }
}
```

---

## Frontend → Backend Messages

### Score Update
Send continuously (recommended every 500ms or on EXP change).
```json
{
  "type": "score_update",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "playerId": "player-123",
    "currentExp": 250,
    "timestamp": 1730816430000
  }
}
```

### Match End
Send when the 1-minute timer expires with final scores.
```json
{
  "type": "match_end",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "player1Id": "player-123",
    "player1Exp": 450,
    "player2Id": "player-456",
    "player2Exp": 320,
    "matchDurationMs": 60000,
    "timestamp": 1730816460000
  }
}
```

### Player Move
Send when the local player moves during the match.
```json
{
  "type": "player_move",
  "payload": {
    "direction": "up",
    "gameId": "game-1730816400000-abc123def",
    "timestamp": 1730816415000
  }
}
```

### Matchmaking
Join or leave the matchmaking queue.
```json
{
  "type": "matchmaking",
  "payload": {
    "action": "join",
    "gameType": "classic"
  }
}
```

### Game Ready
Signal that the player is ready to start the game.
```json
{
  "type": "game_ready",
  "payload": {
    "gameId": "game-1730816400000-abc123def"
  }
}
```

### Ping
Keep-alive ping to maintain connection.
```json
{
  "type": "ping"
}
```

---

## Backend Acknowledgments

### Score Update Acknowledged
```json
{
  "type": "score_update_ack",
  "payload": {
    "success": true,
    "message": "Score updated"
  }
}
```

### Match End Acknowledged
```json
{
  "type": "match_end_ack",
  "payload": {
    "success": true,
    "winnerId": "player-123",
    "isTie": false,
    "finalScores": {
      "player-123": 450,
      "player-456": 320
    }
  }
}
```

---

## Error Messages

### Validation Error
```json
{
  "type": "error",
  "message": "Invalid message format or validation failed"
}
```

### Game Not Found
```json
{
  "type": "error",
  "message": "Game session not found"
}
```

---

## Connection Lifecycle

1. **Client connects** → Receive `welcome` message
2. **Client joins matchmaking** → Receive `matchmaking_result`
3. **Match found** → Receive `game_matched`
4. **Client signals ready** → Game starts when all players ready
5. **Both clients receive** → `game_start` (1-minute timer begins)
6. **During match** → Continuous `score_update` messages
7. **After 60 seconds** → Client sends `match_end` with final scores
8. **Both receive** → `match_ended` with winner determination
9. **Client disconnects** → Connection closed

---

## Important Notes

- ⚠️ **All timestamps must be epoch milliseconds** (Date.now())
- ⚠️ **Match always lasts 60 seconds** (no early endings)
- ⚠️ **Scores must be >= 0**
- ⚠️ **Game IDs follow format**: `game-{timestamp}-{random}`
- ⚠️ **Winner determined by**: `player1Exp > player2Exp ? player1 : player2`
- ✅ **Real-time sync recommended**: Send score updates every 500ms minimum

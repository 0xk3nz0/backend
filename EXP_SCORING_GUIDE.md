# EXP-Based Scoring System Integration Guide

## Overview
The backend now supports a **1-minute EXP-based matching system** where players accumulate EXP during gameplay and the player with the highest EXP at the end of 60 seconds wins.

---

## Game Flow

### 1. **Match Start** (When game_start is received)
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

**Frontend Action:**
- Start the 1-minute countdown timer
- Begin the Pong game
- Initialize EXP tracking to 0 for both players

---

### 2. **Continuous Score Updates** (During the 60-second match)

**Send score updates to backend continuously** (recommended every 500ms or whenever EXP changes):

```json
{
  "type": "score_update",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "playerId": "player-user-123",
    "currentExp": 150,
    "timestamp": 1730816405000
  }
}
```

**Backend Response:**
```json
{
  "type": "score_update",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "scores": {
      "player-user-123": 150,
      "player-opponent-456": 120
    },
    "timestamp": 1730816405000
  }
}
```

**Frontend Action:**
- Display real-time EXP scores for both players
- Update the scoreboard as both players accumulate EXP
- Continue updating until 1-minute expires

---

### 3. **Match End** (After 1 minute expires)

**When the 60-second timer expires, send the final scores:**

```json
{
  "type": "match_end",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "player1Id": "player-user-123",
    "player1Exp": 450,
    "player2Id": "player-opponent-456",
    "player2Exp": 320,
    "matchDurationMs": 60000,
    "timestamp": 1730816460000
  }
}
```

**Backend Response:**
```json
{
  "type": "match_ended",
  "payload": {
    "gameId": "game-1730816400000-abc123def",
    "winnerId": "player-user-123",
    "isTie": false,
    "finalScores": {
      "player-user-123": 450,
      "player-opponent-456": 320
    },
    "matchDurationMs": 60000
  }
}
```

**Frontend Action:**
- Display winner announcement
- Show final scoreboard
- Display EXP gained
- Return to main menu or tournament bracket (if applicable)

---

## Message Types & Schemas

### Score Update Schema
```typescript
{
  gameId: string (min 1 char),
  playerId: string (min 1 char),
  currentExp: number (>= 0),
  timestamp: number (epoch milliseconds)
}
```

### Match End Schema
```typescript
{
  gameId: string (min 1 char),
  player1Id: string (min 1 char),
  player1Exp: number (>= 0),
  player2Id: string (min 1 char),
  player2Exp: number (>= 0),
  matchDurationMs: number (default: 60000),
  timestamp: number (epoch milliseconds)
}
```

---

## Implementation Checklist

- [ ] **Game Start Handler**: Receive `game_start` and start 1-minute timer
- [ ] **Score Tracking**: Accumulate EXP during gameplay
- [ ] **Real-time Sync**: Send `score_update` messages (recommended every 500ms)
- [ ] **Match End Handler**: When timer expires, send `match_end` with final scores
- [ ] **Winner Display**: Show winner and final scores from `match_ended` response
- [ ] **Tournament Integration**: Handle winner advancement for tournament games

---

## Example Frontend Flow

```typescript
// When game starts
onGameStart(payload) {
  matchDurationMs = payload.matchDurationMs; // 60000ms
  startMatchTimer(matchDurationMs);
  initializeEXPScores();
}

// Every 500ms or on EXP change
syncScore() {
  sendToBackend({
    type: 'score_update',
    payload: {
      gameId: currentGameId,
      playerId: currentPlayerId,
      currentExp: playerCurrentExp,
      timestamp: Date.now()
    }
  });
}

// When 60-second timer expires
onMatchTimerExpire() {
  sendToBackend({
    type: 'match_end',
    payload: {
      gameId: currentGameId,
      player1Id: playerId1,
      player1Exp: finalExpPlayer1,
      player2Id: playerId2,
      player2Exp: finalExpPlayer2,
      matchDurationMs: 60000,
      timestamp: Date.now()
    }
  });
}

// Handle match end from backend
onMatchEnded(payload) {
  displayWinner(payload.winnerId);
  displayFinalScores(payload.finalScores);
  // Handle tournament advancement if needed
}
```

---

## Winner Determination

The backend automatically determines the winner:
- **Player 1 Wins**: `player1Exp > player2Exp`
- **Player 2 Wins**: `player2Exp > player1Exp`
- **Tie**: `player1Exp === player2Exp` (winnerId will be null)

---

## Tournament Integration

For tournament matches, the winning player is **automatically advanced** to the next round. No additional action needed from the frontend.

---

## Notes

- ✅ Matches always last exactly **60 seconds** (no early endings)
- ✅ EXP scores update in real-time to both players
- ✅ No point limits - only 1-minute duration matters
- ✅ Bot opponents automatically get random EXP values
- ✅ Scores are continuously synced for a live leaderboard experience

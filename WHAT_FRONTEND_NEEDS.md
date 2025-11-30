# Frontend Requirements for EXP-Based Pong Game

This document outlines exactly what the frontend needs to implement to complete the game integration.

---

## Overview

The backend is **fully ready**. The frontend needs to:
1. Track EXP during gameplay
2. Send real-time score updates to the backend
3. Display live opponent scores
4. Handle match end and winner announcement

---

## 1. Receiving Game Start

**Message from backend:**
```javascript
{
  type: 'game_start',
  data: {
    gameId: string,
    player1: { id: string, name: string },
    player2: { id: string, name: string },
    matchDurationMs: 60000  // Always 60 seconds
  }
}
```

**What frontend needs to do:**
- Store `gameId` for later use
- Identify which player is "you" vs "opponent"
- **Start a 60-second countdown timer**
- Initialize scoreboard showing both players with 0 EXP
- Begin game loop and start tracking EXP

---

## 2. Tracking & Sending EXP Updates

**During gameplay (every 500ms recommended):**

Frontend needs to:
1. Track how much EXP the player has earned
2. Send `score_update` message to backend

**Message to send:**
```javascript
{
  type: 'score_update',
  data: {
    gameId: string,           // From game_start
    playerId: string,         // Current player's ID
    currentExp: number,       // Total EXP earned so far (e.g., 150)
    timestamp: number         // Current time in ms
  }
}
```

**Example timing:**
```
T=0s:   Game starts, EXP = 0
T=1s:   Player scores → EXP = 50, send score_update
T=2s:   Player scores → EXP = 100, send score_update
T=5s:   Player scores → EXP = 150, send score_update
...continue every time EXP changes or every 500ms...
```

---

## 3. Receiving Real-Time Opponent Scores

**Message from backend:**
```javascript
{
  type: 'score_update',
  data: {
    scores: {
      [playerId1]: number,  // Opponent's current EXP
      [playerId2]: number   // Your current EXP
    },
    timestamp: number
  }
}
```

**What frontend needs to do:**
- Update the scoreboard with opponent's EXP
- Display both players' EXP in real-time
- No other action needed - just display the numbers

---

## 4. Sending Match End

**When 60-second timer expires:**

Frontend needs to:
1. Stop the game
2. Calculate final EXP for both players
3. Send `match_end` message

**Message to send:**
```javascript
{
  type: 'match_end',
  data: {
    gameId: string,              // From game_start
    player1Id: string,           // First player's ID
    player1Exp: number,          // First player's final EXP
    player2Id: string,           // Second player's ID
    player2Exp: number,          // Second player's final EXP
    matchDurationMs: 60000,      // Always 60000
    timestamp: number            // Current time in ms
  }
}
```

**Example:**
```javascript
{
  type: 'match_end',
  data: {
    gameId: '550e8400-e29b-41d4-a716-446655440000',
    player1Id: 'user123',
    player1Exp: 450,
    player2Id: 'user456',
    player2Exp: 380,
    matchDurationMs: 60000,
    timestamp: 1732570800000
  }
}
```

---

## 5. Receiving Match Result

**Message from backend:**
```javascript
{
  type: 'match_ended',
  data: {
    gameId: string,
    winnerId: string | null,     // null if tie
    player1Id: string,
    player1Exp: number,
    player2Id: string,
    player2Exp: number,
    result: 'win' | 'loss' | 'tie'
  }
}
```

**What frontend needs to do:**
- Display winner announcement
- Show final scores for both players
- Show result message: "You Won!" or "You Lost!" or "Tie!"
- Offer option to return to menu or play again

---

## Implementation Checklist

### Game Initialization
- [ ] Parse `game_start` message
- [ ] Extract `gameId`, player info, `matchDurationMs`
- [ ] Initialize 60-second countdown timer
- [ ] Display scoreboard with both players
- [ ] Start game logic

### During Gameplay (60 seconds)
- [ ] Track current player's EXP accumulation
- [ ] Every 500ms (or when EXP changes): send `score_update`
- [ ] Receive `score_update` messages and update opponent's EXP display
- [ ] Update countdown timer on UI
- [ ] Keep game running for full 60 seconds

### Game End (After 60 seconds)
- [ ] Send `match_end` with final EXP totals
- [ ] Receive `match_ended` message
- [ ] Display winner and final scores
- [ ] Show "You Won!", "You Lost!", or "Tie!"
- [ ] Provide navigation back to menu

---

## Example Code Flow

```typescript
// When game_start received
onGameStart(data) {
  this.gameId = data.gameId;
  this.yourPlayerId = getCurrentUserId();
  this.opponentId = data.player1.id === this.yourPlayerId ? data.player2.id : data.player1.id;
  this.matchEndTime = Date.now() + 60000; // 60 seconds from now

  // Start game loop
  this.startGameLoop();
  this.startTimerDisplay();
}

// Game loop (called every frame)
gameLoop() {
  // Update game state, check collisions, etc.
  this.currentExp = calculatePlayerExp();

  // Send score updates every 500ms
  if (Date.now() - this.lastScoreUpdateTime > 500) {
    this.sendScoreUpdate();
    this.lastScoreUpdateTime = Date.now();
  }
}

// Send score update
sendScoreUpdate() {
  this.websocket.send({
    type: 'score_update',
    data: {
      gameId: this.gameId,
      playerId: this.yourPlayerId,
      currentExp: this.currentExp,
      timestamp: Date.now()
    }
  });
}

// When score_update received from opponent
onScoreUpdate(data) {
  // Update opponent's score on UI
  this.opponentExp = data.scores[this.opponentId];
}

// Timer expires (60 seconds)
onTimerExpire() {
  this.endGame();

  // Send match end
  this.websocket.send({
    type: 'match_end',
    data: {
      gameId: this.gameId,
      player1Id: this.yourPlayerId,
      player1Exp: this.currentExp,
      player2Id: this.opponentId,
      player2Exp: this.opponentExp,
      matchDurationMs: 60000,
      timestamp: Date.now()
    }
  });
}

// When match_ended received
onMatchEnded(data) {
  const result = data.winnerId === this.yourPlayerId ? 'win' :
                 data.winnerId === null ? 'tie' : 'loss';

  this.showWinnerScreen(data.player1Exp, data.player2Exp, result);
}
```

---

## Critical Points

⚠️ **Important for Frontend:**

1. **60-Second Timer is MANDATORY** - The match ALWAYS ends after exactly 60 seconds
2. **EXP is Cumulative** - Track total EXP earned during the 60 seconds
3. **Send Final Scores** - Frontend must send the final EXP totals via `match_end`
4. **Backend Determines Winner** - Don't calculate winner on frontend; backend decides based on EXP
5. **Real-Time Updates** - Opponent's EXP should update as `score_update` messages arrive
6. **No Point Limits** - There's no "first to X points"; timer is the only end condition

---

## Message Reference

| Message | Direction | When | Content |
|---------|-----------|------|---------|
| `game_start` | Backend → Frontend | When matched | Match start info, player IDs, 60s duration |
| `score_update` | Both Ways | Every 500ms during match | Current EXP for both players |
| `match_end` | Frontend → Backend | When timer expires | Final EXP scores |
| `match_ended` | Backend → Frontend | After match_end received | Winner ID, final scores, result |

---

## Testing Tips

1. **Test with bot**: Bot opponent will send random EXP increases
2. **Test with 2 clients**: Open frontend in 2 windows to test real-time sync
3. **Test timer accuracy**: Verify match ends exactly at 60 seconds
4. **Test score updates**: Verify opponent's score updates as you send messages
5. **Test winner logic**: Send different final scores and verify correct winner

---

## Questions?

- Backend is production-ready
- All validation happens on backend
- Frontend just needs to track EXP and send/receive the 4 message types
- Each match is isolated with its own `gameId`

Good luck with the frontend! 🚀

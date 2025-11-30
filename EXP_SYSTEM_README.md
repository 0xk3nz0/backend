# ⚡ EXP Scoring System - Implementation Summary

## What's Been Implemented

### Backend Changes (Game Service)
✅ **New Schemas** (in `src/schemas/game.ts`):
- `scoreUpdateSchema` - For real-time EXP updates
- `matchEndSchema` - For final match results

✅ **New Game Service Methods** (in `src/services/game.ts`):
- `handleScoreUpdate()` - Processes continuous EXP updates during match
- `handleMatchEnd()` - Processes final scores and determines winner
- Enhanced `startGame()` - Now starts a 60-second match timer
- Enhanced `createGameSession()` - Now tracks EXP scores for both players

✅ **Controller Integration** (in `src/controllers/game.ts`):
- Added `score_update` message handler
- Added `match_end` message handler
- Both handlers validate input and broadcast to players

### Features
✅ **1-Minute Match Duration** - Exactly 60 seconds per match
✅ **Real-Time Score Syncing** - Scores broadcast to both players
✅ **EXP-Based Winner** - Highest EXP at end wins
✅ **Tie Detection** - Handles equal scores
✅ **Tournament Integration** - Winner auto-advances in tournaments
✅ **Bot Support** - Bot opponents work with EXP system

---

## How It Works

### 1️⃣ Match Starts
- Backend creates game session with EXP scores initialized to 0
- Sends `game_start` message with 60-second duration

### 2️⃣ During Match (60 seconds)
- Frontend accumulates EXP as players play
- Frontend sends `score_update` messages (recommended every 500ms)
- Backend broadcasts updated scores to both players
- Scoreboard shows real-time EXP for both players

### 3️⃣ Match Ends
- Frontend timer expires after 60 seconds
- Frontend sends `match_end` with final EXP scores
- Backend compares scores and determines winner:
  - Player 1 EXP > Player 2 EXP → Player 1 wins
  - Player 2 EXP > Player 1 EXP → Player 2 wins
  - Equal EXP → Tie (winnerId = null)

### 4️⃣ Result
- Backend sends `match_ended` to both players
- Winner is displayed
- For tournaments: winning player auto-advances

---

## Frontend Integration Checklist

### Messages to Send
- [ ] `score_update` - Every 500ms with current EXP
- [ ] `match_end` - When 60-second timer expires with final scores

### Messages to Handle
- [ ] `game_start` - Start 1-minute countdown timer
- [ ] `score_update` - Update opponent's EXP on scoreboard
- [ ] `match_ended` - Display winner and final scores

### UI Components Needed
- [ ] 1-minute countdown timer display
- [ ] Real-time scoreboard (EXP for both players)
- [ ] Winner announcement screen
- [ ] EXP accumulation display during gameplay

---

## API Reference

### Handle Score Update
```typescript
async handleScoreUpdate(userId: string, payload: ScoreUpdateInput)
```
**Payload:**
```javascript
{
  gameId: string,
  playerId: string,
  currentExp: number,
  timestamp: number
}
```

### Handle Match End
```typescript
async handleMatchEnd(initiatorId: string, payload: MatchEndInput)
```
**Payload:**
```javascript
{
  gameId: string,
  player1Id: string,
  player1Exp: number,
  player2Id: string,
  player2Exp: number,
  matchDurationMs: number,
  timestamp: number
}
```

---

## Example Frontend Timeline

```
T=0s:    Receive game_start → Start 60s timer, show scoreboard
T=5s:    Player gains 50 EXP → Send score_update(50)
T=10s:   Receive score_update → Update opponent EXP on scoreboard
T=15s:   Player gains 100 EXP → Send score_update(100)
...continue...
T=55s:   Both players' final EXP accumulated
T=60s:   Timer expires → Send match_end with final scores
         Receive match_ended → Show winner and final scores
T=65s:   Return to menu or tournament bracket
```

---

## Documentation Files

📄 **EXP_SCORING_GUIDE.md** - Complete integration guide with examples
📄 **WEBSOCKET_MESSAGES.md** - All message formats reference

---

## Status

✅ **Backend**: Fully Implemented & Tested
⏳ **Frontend**: Awaiting implementation with this guide
🎯 **Tournament**: Auto-winner advancement enabled
🤖 **Bots**: Supported (can be given random EXP)

---

## Testing

To test the system:

1. Start backend server: `npm run dev`
2. Connect two clients to WebSocket
3. Both join matchmaking
4. When matched, both get `game_start`
5. Both start sending `score_update` messages
6. After 60 seconds, send `match_end` with scores
7. Verify `match_ended` is received with correct winner

---

## Questions or Issues?

Key points to remember:
- ⏱️ Matches are **always 60 seconds**
- 📊 **Real-time sync** is continuous, not per-point
- 🏆 **Winner is whoever has highest EXP** at 60s mark
- 🎯 **No other ending conditions** - timer is the only rule
- 📤 **Frontend sends final scores** to backend (backend doesn't track ball physics)

Good luck with the frontend integration! 🚀

# Tournament System Usage Guide

## Overview
The tournament system allows players to create and participate in single-elimination bracket tournaments. Players can create tournaments, join them, and compete in automatically managed brackets.

## WebSocket Message Types

### 1. Create Tournament
```javascript
// Create a new tournament
websocket.send(JSON.stringify({
  type: 'tournament_action',
  payload: {
    action: 'create',
    tournamentData: {
      name: 'Friday Night Tournament',
      maxPlayers: 8,
      description: 'Weekly competition',
      isPrivate: false,
      password: undefined // Only required for private tournaments
    }
  }
}));
```

### 2. Join Tournament
```javascript
// Join an existing tournament
websocket.send(JSON.stringify({
  type: 'tournament_action',
  payload: {
    action: 'join',
    tournamentId: 'tournament-1234567890-abc123',
    tournamentData: {
      password: 'secret' // Only for private tournaments
    }
  }
}));
```

### 3. Start Tournament (Creator Only)
```javascript
// Start the tournament (minimum 4 players, must be power of 2)
websocket.send(JSON.stringify({
  type: 'tournament_action',
  payload: {
    action: 'start',
    tournamentId: 'tournament-1234567890-abc123'
  }
}));
```

### 4. Get Tournament Info
```javascript
// Get current tournament information
websocket.send(JSON.stringify({
  type: 'tournament_action',
  payload: {
    action: 'get_info',
    tournamentId: 'tournament-1234567890-abc123'
  }
}));
```

### 5. Leave Tournament
```javascript
// Leave a tournament (before it starts)
websocket.send(JSON.stringify({
  type: 'tournament_action',
  payload: {
    action: 'leave',
    tournamentId: 'tournament-1234567890-abc123'
  }
}));
```

### 6. Submit Game Result (Tournament Matches)
```javascript
// Submit the result of a tournament match
websocket.send(JSON.stringify({
  type: 'game_result',
  payload: {
    gameId: 'game-1234567890-xyz789',
    winnerId: 'player-user-id',
    score: {
      player1: 10,
      player2: 8
    }
  }
}));
```

### 7. Get Available Tournaments
```javascript
// Get list of all available tournaments
websocket.send(JSON.stringify({
  type: 'get_tournaments'
}));
```

## Server Events (Received Messages)

### Tournament Events
- `tournament_action_result` - Response to tournament actions
- `tournament_player_joined` - New player joined the tournament
- `tournament_player_left` - Player left the tournament
- `tournament_started` - Tournament has begun
- `tournament_round_started` - New round started
- `tournament_match_ready` - Your tournament match is ready
- `tournament_match_completed` - A match in your tournament finished
- `tournament_completed` - Tournament finished with winner
- `tournaments_list` - List of available tournaments

### Game Events (for tournament matches)
- `game_matched` - Regular matchmaking
- `tournament_match_ready` - Tournament-specific match ready

## Tournament Flow

1. **Creation**: A player creates a tournament with specific settings
2. **Registration**: Players join the tournament (up to maxPlayers)
3. **Start**: Creator starts the tournament when ready (min 4 players)
4. **Bracket Generation**: System creates single-elimination bracket
5. **Round 1**: First round matches begin automatically
6. **Match Completion**: Players submit results, winners advance
7. **Next Rounds**: System automatically creates subsequent rounds
8. **Finals**: Final match determines tournament winner

## Tournament Rules

- **Player Count**: Must be a power of 2 (4, 8, 16, 32, 64)
- **Minimum Players**: 4 players required to start
- **Single Elimination**: Lose once, you're out
- **Auto Advancement**: Winners automatically advance to next round
- **Disconnection**: Disconnecting during a match results in forfeit
- **Creator Rights**: Only tournament creator can start the tournament

## Example Tournament Structure (8 Players)

```
Round 1 (Quarterfinals):
├── Match 1: Player A vs Player B
├── Match 2: Player C vs Player D
├── Match 3: Player E vs Player F
└── Match 4: Player G vs Player H

Round 2 (Semifinals):
├── Match 5: Winner 1 vs Winner 2
└── Match 6: Winner 3 vs Winner 4

Round 3 (Finals):
└── Match 7: Winner 5 vs Winner 6
```

## Error Handling

Common errors you might encounter:
- `Tournament not found` - Invalid tournament ID
- `Tournament is full` - Maximum players reached
- `Tournament has already started` - Cannot join ongoing tournament
- `Only the tournament creator can start` - Start permission denied
- `Invalid password` - Wrong password for private tournament
- `Player count must be a power of 2` - Invalid bracket size

## Best Practices

1. **Always check tournament status** before attempting actions
2. **Handle disconnections gracefully** - they result in forfeits
3. **Submit game results promptly** to keep tournaments moving
4. **Use appropriate player counts** (8 or 16 are popular choices)
5. **Monitor tournament events** to stay updated on progress

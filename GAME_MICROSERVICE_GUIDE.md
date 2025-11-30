# Game Microservice Isolation Plan

## Overview

Convert the game service from an integrated module into a standalone microservice that communicates with the main backend via HTTP/WebSocket.

---

## Architecture

```
Main Backend (Port 3002)
├─ Auth Service
├─ User Service
├─ Friend Service
├─ Chat Service
└─ Game Client (communicates to Game Microservice)

Game Microservice (Port 3003)
├─ Game Service
├─ Matchmaking
├─ Bot AI
├─ Tournament System
└─ EXP Scoring
```

---

## Step 1: Create New Microservice Project

```bash
cd /home/g0dr1c/Desktop
mkdir game-microservice
cd game-microservice
npm init -y
```

---

## Step 2: Copy Game Files to Microservice

### From `/backend/src/` copy:
```
game-microservice/src/
├── services/
│   └── game.ts          # Core game logic
├── controllers/
│   └── game.ts          # WebSocket handlers
├── schemas/
│   └── game.ts          # Zod validation
├── routes/
│   └── game.ts          # WebSocket route
├── types/
│   ├── fastify-jwt.d.ts
│   ├── fastify.d.ts
│   ├── service-manager.d.ts
│   └── friend.d.ts
├── utils/
│   ├── logger.ts
│   ├── prisma.ts
│   └── service-error.ts
├── plugins/
│   ├── jwt.ts
│   └── service.ts
├── app.ts              # NEW: Microservice app
└── server.ts           # Reuse or adapt
```

---

## Step 3: Setup Microservice package.json

```json
{
  "name": "game-microservice",
  "version": "1.0.0",
  "description": "Game microservice for Pong Rush",
  "main": "src/app.ts",
  "type": "module",
  "scripts": {
    "start": "tsx --watch src/app.ts",
    "dev": "nodemon",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/cors": "^11.1.0",
    "@fastify/jwt": "^10.0.0",
    "@fastify/websocket": "^11.2.0",
    "@prisma/client": "^6.17.1",
    "fastify": "^5.5.0",
    "fastify-plugin": "^5.0.1",
    "fastify-type-provider-zod": "^6.0.0",
    "uuid": "^13.0.0",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@types/node": "^24.7.2",
    "@types/ws": "^8.18.1",
    "nodemon": "^3.1.10",
    "prisma": "^6.17.1",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  }
}
```

---

## Step 4: Setup .env for Microservice

**game-microservice/.env:**
```
PORT=3003
NODE_ENV=development

# Database (can be same or separate)
DATABASE_URL="file:./prisma/game.db"

# JWT (should match main backend)
JWT_SECRET=your_jwt_secret

# Main Backend Communication
MAIN_BACKEND_URL=http://localhost:3002
MAIN_BACKEND_API_KEY=your_api_key_for_service_auth

# Logging
LOG_LEVEL=info
```

---

## Step 5: Create Microservice app.ts

**game-microservice/src/app.ts:**
```typescript
import { configDotenv } from "dotenv";
configDotenv();

import Server from "./server.js";
import GameRoutes from './routes/game.js';
import JWTAuthenticationPlugin from './plugins/jwt.js';
import ServiceManagerPlugin from './plugins/service.js';

const routes = [
  {
    pcb: GameRoutes,
    opt: { prefix: '/game' }
  }
];

const hooks = {};

const secrets = {
  jwt: process.env.JWT_SECRET || 'supersecret',
  api_key: process.env.MAIN_BACKEND_API_KEY || 'supersecret'
};

const app = new Server(
  '0.0.0.0',
  parseInt(process.env.PORT || '3003'),
  [],
  {},
  routes,
  hooks,
  secrets,
  [ServiceManagerPlugin, JWTAuthenticationPlugin]
);

await app.run();
```

---

## Step 6: Update Main Backend (Remove Game Logic)

### In `/backend/src/app.ts`:

**Remove:**
```typescript
import GameRoutes from './routes/game.js'
```

**Remove from routes array:**
```typescript
{
  pcb: GameRoutes,
  opt: { prefix: '/v1/game'}
}
```

**Add Game Proxy Route:**
```typescript
// Game Microservice Proxy
app.register(async (fastify) => {
  fastify.all('/v1/game/*', async (request, reply) => {
    const gameServiceUrl = process.env.GAME_SERVICE_URL || 'http://localhost:3003';
    const path = request.url.replace('/v1/game', '');

    try {
      const response = await fetch(`${gameServiceUrl}${path}`, {
        method: request.method,
        headers: {
          ...request.headers,
          'Authorization': request.headers.authorization || ''
        },
        body: request.method !== 'GET' ? JSON.stringify(request.body) : undefined
      });

      reply.send(await response.json());
    } catch (error) {
      reply.code(503).send({ error: 'Game service unavailable' });
    }
  });
});
```

### In `/backend/.env`:
```
GAME_SERVICE_URL=http://localhost:3003
```

---

## Step 7: Setup Microservice Prisma

**game-microservice/prisma/schema.prisma:**
```prisma
// Minimal schema for game service
// Can reference user data from main backend via API calls

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Only store game-specific data
model GameSession {
  id            String   @id @default(uuid())
  player1Id     String
  player2Id     String
  gameType      String   @default("classic")
  status        String   @default("active")
  player1Exp    Int      @default(0)
  player2Exp    Int      @default(0)
  winnerId      String?
  createdAt     DateTime @default(now())
  endedAt       DateTime?

  @@index([status])
  @@index([createdAt])
}

model Tournament {
  id        String   @id @default(uuid())
  name      String
  creatorId String
  status    String   @default("waiting_for_players")
  createdAt DateTime @default(now())

  @@index([status])
}
```

---

## Step 8: Docker Compose for Local Development

**docker-compose.yml (in backend root):**
```yaml
version: '3.8'

services:
  main-backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=development
      - GAME_SERVICE_URL=http://game-microservice:3003
    depends_on:
      - game-microservice

  game-microservice:
    build:
      context: ../game-microservice
      dockerfile: Dockerfile
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=development
      - PORT=3003
      - MAIN_BACKEND_URL=http://main-backend:3002

  sqlite-db:
    image: sqlite:latest
    volumes:
      - ./prisma:/app/data
    ports:
      - "5432:5432"
```

---

## Step 9: Communication Between Services

### Main Backend → Game Microservice

**For user authentication verification:**
```typescript
// In game-microservice, verify JWT token
const verifyUserWithMainBackend = async (userId: string, token: string) => {
  const response = await fetch(
    `${process.env.MAIN_BACKEND_URL}/v1/user/${userId}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.json();
};
```

### Game Microservice → Main Backend

**For game results (optional):**
```typescript
// Store match results in main backend
const notifyMainBackendOfResult = async (gameId: string, winnerId: string) => {
  await fetch(
    `${process.env.MAIN_BACKEND_URL}/v1/user/game-result`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, winnerId })
    }
  );
};
```

---

## Step 10: Deployment

### Local Testing
```bash
# Terminal 1: Main Backend
cd /home/g0dr1c/Desktop/backend
npm run dev

# Terminal 2: Game Microservice
cd /home/g0dr1c/Desktop/game-microservice
npm run dev
```

### Docker Deployment
```bash
cd /home/g0dr1c/Desktop/backend
docker-compose up -d
```

### Production Kubernetes
```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-microservice
spec:
  replicas: 2
  selector:
    matchLabels:
      app: game-microservice
  template:
    metadata:
      labels:
        app: game-microservice
    spec:
      containers:
      - name: game-microservice
        image: your-registry/game-microservice:latest
        ports:
        - containerPort: 3003
        env:
        - name: PORT
          value: "3003"
        - name: MAIN_BACKEND_URL
          value: "http://main-backend:3002"
---
apiVersion: v1
kind: Service
metadata:
  name: game-microservice
spec:
  selector:
    app: game-microservice
  ports:
  - protocol: TCP
    port: 3003
    targetPort: 3003
  type: LoadBalancer
```

---

## Benefits of Microservice Approach

✅ **Scalability**: Scale game service independently
✅ **Isolation**: Game crashes don't affect auth/users
✅ **Technology**: Can use different tech stack if needed
✅ **Team**: Separate team can work on game service
✅ **Deployment**: Deploy game updates without restarting main backend
✅ **Load Balancing**: Run multiple game instances
✅ **Monitoring**: Separate logs and metrics for game service

---

## Migration Path

1. **Phase 1**: Copy game files, setup new project, run locally
2. **Phase 2**: Test with existing frontend
3. **Phase 3**: Add Docker Compose
4. **Phase 4**: Update main backend to proxy requests
5. **Phase 5**: Deploy to production

---

## Questions?

Key points:
- Game service runs on separate port (3003)
- JWT validation still handled by game service
- Main backend proxies `/v1/game/*` requests to game service
- WebSocket connections directly to game service
- Can scale horizontally with load balancer

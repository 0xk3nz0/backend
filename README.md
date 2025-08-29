<h2> <img width="30" src="https://emojis.slackmojis.com/emojis/images/1643514389/3643/cool-doge.gif?1643514389"> ft_transcendence Backend </h2>

Backend API for ft_transcendence - a real-time multiplayer Pong web application 🏓

<div align="center">
    <img hight="400" width="800" src="https://i.pinimg.com/originals/be/f8/9c/bef89c0c96720bbe87774b71fed524a7.gif">
</div>

## Table of Contents

- [Tech Stack](#tech-stack-)
- [Features](#features-)
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites-)
    - [Installation](#installation-️)
    - [Docker setup](#docker-setup-)
- [API Documentation](#api-documentation-)
- [Database Schema](#database-schema-️)
- [Testing](#testing-)
- [Contributing](#contributing-)
- [License](#license-)

---

## Tech Stack 📚

- **Framework**: Fastify with TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT + OAuth 2.0 (Google)
- **Security**: 2FA, bcrypt password hashing
- **Real-time**: WebSocket for chat and game updates
- **Containerization**: Docker

## Features ✨

- User authentication and registration
- Google OAuth integration
- Real-time chat system with blocking
- Friend management system
- Match history and statistics
- Tournament management
- Two-Factor Authentication (2FA)
- Secure session management

---

## Getting Started

### Prerequisites 🔑

- Node.js 18+
- Docker
- npm or yarn

### Installation 🛠️

1. Clone the repository
```bash
git clone <repo-url> ft_transcendence-backend
cd ft_transcendence-backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database
```bash
npx prisma migrate dev
npx prisma generate
```

5. Start development server
```bash
npm run dev
```

### Docker Setup 🐳

```bash
docker-compose up -d
```
---

## API Documentation 📄

The API documentation is available at `/docs` when the server is running.

## Database Schema 🗂️

Generate and view the database schema:
```bash
npx prisma studio
```

## Testing 🧪

```bash
npm test
```

## Contributing 🤝

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and guidelines.

## License 📜

This project is part of the 42 School curriculum.
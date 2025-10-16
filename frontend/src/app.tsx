import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Gamepad2, Radio, Activity, Clock, Bot, User, Play, Pause } from 'lucide-react';

interface Message {
  type: string;
  data: any;
  timestamp: string;
}

interface GameState {
  inQueue: boolean;
  inGame: boolean;
  gameId: string | null;
  opponentIsBot: boolean;
  queuePosition: number | null;
  queueSize: number | null;
}

interface PongGameState {
  ball: { x: number; y: number; dx: number; dy: number };
  leftPaddle: { y: number };
  rightPaddle: { y: number };
  score: { left: number; right: number };
  gameStarted: boolean;
  isPaused: boolean;
}

interface Stats {
  activeConnections: number;
  gameSessions: number;
  matchmakingQueue: number;
}

export default function PongGame() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>('');
  const [wsUrl, setWsUrl] = useState<string>('ws://localhost:3000/v1/game/ws/game');
  const [messages, setMessages] = useState<Message[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    inQueue: false,
    inGame: false,
    gameId: null,
    opponentIsBot: false,
    queuePosition: null,
    queueSize: null
  });
  const [stats, setStats] = useState<Stats>({
    activeConnections: 0,
    gameSessions: 0,
    matchmakingQueue: 0
  });
  const [pongState, setPongState] = useState<PongGameState>({
    ball: { x: 400, y: 200, dx: 4, dy: 3 },
    leftPaddle: { y: 150 },
    rightPaddle: { y: 150 },
    score: { left: 0, right: 0 },
    gameStarted: false,
    isPaused: false
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    setUserId(`player-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pong game constants
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 400;
  const PADDLE_WIDTH = 10;
  const PADDLE_HEIGHT = 80;
  const BALL_SIZE = 10;
  const PADDLE_SPEED = 6;

  // Pong game rendering function
  const drawPong = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw center line
    ctx.setLineDash([5, 15]);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    ctx.fillStyle = '#fff';
    // Left paddle (player)
    ctx.fillRect(20, pongState.leftPaddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);
    // Right paddle (opponent/bot)
    ctx.fillRect(CANVAS_WIDTH - 30, pongState.rightPaddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw ball
    ctx.beginPath();
    ctx.arc(pongState.ball.x, pongState.ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Draw scores
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(pongState.score.left.toString(), CANVAS_WIDTH / 4, 60);
    ctx.fillText(pongState.score.right.toString(), (3 * CANVAS_WIDTH) / 4, 60);

    // Draw game status
    if (!pongState.gameStarted) {
      ctx.font = '24px Arial';
      ctx.fillText('Press SPACE to start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    } else if (pongState.isPaused) {
      ctx.font = '24px Arial';
      ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
  }, [pongState]);

  // Pong game update logic
  const updatePong = useCallback(() => {
    if (!pongState.gameStarted || pongState.isPaused) return;

    setPongState(prev => {
      const newState = { ...prev };

      // Update ball position
      newState.ball.x += newState.ball.dx;
      newState.ball.y += newState.ball.dy;

      // Ball collision with top and bottom walls
      if (newState.ball.y <= BALL_SIZE / 2 || newState.ball.y >= CANVAS_HEIGHT - BALL_SIZE / 2) {
        newState.ball.dy = -newState.ball.dy;
      }

      // Ball collision with paddles
      const ballLeft = newState.ball.x - BALL_SIZE / 2;
      const ballRight = newState.ball.x + BALL_SIZE / 2;
      const ballTop = newState.ball.y - BALL_SIZE / 2;
      const ballBottom = newState.ball.y + BALL_SIZE / 2;

      // Left paddle collision
      if (ballLeft <= 30 &&
          ballRight >= 20 &&
          ballBottom >= newState.leftPaddle.y &&
          ballTop <= newState.leftPaddle.y + PADDLE_HEIGHT) {
        newState.ball.dx = Math.abs(newState.ball.dx);
        // Add some spin based on where ball hits paddle
        const paddleCenter = newState.leftPaddle.y + PADDLE_HEIGHT / 2;
        const hitPos = (newState.ball.y - paddleCenter) / (PADDLE_HEIGHT / 2);
        newState.ball.dy = hitPos * 4;
      }

      // Right paddle collision
      if (ballRight >= CANVAS_WIDTH - 30 &&
          ballLeft <= CANVAS_WIDTH - 20 &&
          ballBottom >= newState.rightPaddle.y &&
          ballTop <= newState.rightPaddle.y + PADDLE_HEIGHT) {
        newState.ball.dx = -Math.abs(newState.ball.dx);
        const paddleCenter = newState.rightPaddle.y + PADDLE_HEIGHT / 2;
        const hitPos = (newState.ball.y - paddleCenter) / (PADDLE_HEIGHT / 2);
        newState.ball.dy = hitPos * 4;
      }

      // Score points
      if (newState.ball.x < 0) {
        newState.score.right++;
        newState.ball = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 4, dy: 3 };
      } else if (newState.ball.x > CANVAS_WIDTH) {
        newState.score.left++;
        newState.ball = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: -4, dy: 3 };
      }

      return newState;
    });
  }, [pongState.gameStarted, pongState.isPaused]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      updatePong();
      drawPong();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (gameState.inGame) {
      animate();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.inGame, updatePong, drawPong]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!gameState.inGame) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          if (!pongState.gameStarted) {
            setPongState(prev => ({ ...prev, gameStarted: true }));
          } else {
            setPongState(prev => ({ ...prev, isPaused: !prev.isPaused }));
          }
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          event.preventDefault();
          movePaddle('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          event.preventDefault();
          movePaddle('down');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.inGame, pongState.gameStarted]);

  const addMessage = (type: string, data: any) => {
    setMessages(prev => [...prev, {
      type,
      data,
      timestamp: new Date().toLocaleTimeString()
    }].slice(-20));
  };

  const connect = () => {
    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setConnected(true);
        addMessage('system', 'Connected to server');

        // Send ping to establish connection (game server doesn't need auth)
        socket.send(JSON.stringify({
          type: 'ping'
        }));
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        addMessage('received', message);

        // Handle different message types
        switch(message.type) {
          case 'welcome':
            addMessage('system', `Welcome! ${message.message}`);
            // Update stats from welcome message
            if (message.stats) {
              setStats(message.stats);
            }
            break;
          case 'pong':
            // Ping/pong response - connection is working
            break;
          case 'game_matched':
            setGameState({
              inQueue: false,
              inGame: true,
              gameId: message.payload.id,
              opponentIsBot: message.payload.opponentIsBot,
              queuePosition: null,
              queueSize: null
            });

            // Reset Pong game state for new match
            setPongState({
              ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
              leftPaddle: { y: 150 },
              rightPaddle: { y: 150 },
              score: { left: 0, right: 0 },
              gameStarted: false,
              isPaused: false
            });

            addMessage('system', `Game matched! ${message.payload.opponentIsBot ? 'Playing against bot' : 'Playing against human'}`);
            break;
          case 'matchmaking_result':
            if (message.payload.position) {
              setGameState(prev => ({
                ...prev,
                queuePosition: message.payload.position,
                queueSize: message.payload.queueSize
              }));
            }
            break;
          case 'game_start':
            addMessage('system', 'Game started!');
            // Auto-start the Pong game when server game starts
            setPongState(prev => ({
              ...prev,
              gameStarted: true,
              isPaused: false
            }));
            break;
          case 'player_moved':
            // Handle player/bot movement updates
            if (message.payload) {
              const { userId, direction, isBot } = message.payload;

              // Update paddle positions based on server movements
              setPongState(prev => {
                const newState = { ...prev };
                const moveAmount = PADDLE_SPEED * 2; // Make server movements more noticeable

                if (isBot) {
                  // Update right paddle (bot/opponent)
                  if (direction === 'up') {
                    newState.rightPaddle.y = Math.max(0, prev.rightPaddle.y - moveAmount);
                  } else if (direction === 'down') {
                    newState.rightPaddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.rightPaddle.y + moveAmount);
                  }
                } else {
                  // Update left paddle (opponent human player)
                  if (direction === 'up') {
                    newState.leftPaddle.y = Math.max(0, prev.leftPaddle.y - moveAmount);
                  } else if (direction === 'down') {
                    newState.leftPaddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.leftPaddle.y + moveAmount);
                  }
                }

                return newState;
              });

              addMessage('game', `${isBot ? '🤖 Bot' : 'Player'} ${userId} moved ${direction}`);
            }
            break;
          case 'player_disconnected':
            addMessage('system', 'Opponent disconnected');
            setGameState(prev => ({ ...prev, inGame: false }));
            break;
        }
      };

      socket.onclose = () => {
        setConnected(false);
        setGameState({
          inQueue: false,
          inGame: false,
          gameId: null,
          opponentIsBot: false,
          queuePosition: null,
          queueSize: null
        });
        addMessage('system', 'Disconnected from server');
      };

      socket.onerror = (error) => {
        addMessage('error', 'Connection error');
      };

      setWs(socket);
    } catch (error) {
      addMessage('error', `Failed to connect: ${(error as Error).message}`);
    }
  };

  const disconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  };

  const sendMessage = (type: string, payload: any) => {
    if (ws && connected) {
      const message = { type, payload };
      ws.send(JSON.stringify(message));
      addMessage('sent', message);
    }
  };

  const joinMatchmaking = () => {
    sendMessage('matchmaking', {
      action: 'join',
      gameType: 'classic'
    });
    setGameState(prev => ({ ...prev, inQueue: true }));
  };

  const leaveMatchmaking = () => {
    sendMessage('matchmaking', {
      action: 'leave',
      gameType: 'classic'
    });
    setGameState(prev => ({ ...prev, inQueue: false }));
  };

  const sendReady = () => {
    if (gameState.gameId) {
      sendMessage('game_ready', {
        gameId: gameState.gameId
      });
    }
  };

  const movePaddle = (direction: 'up' | 'down') => {
    setPongState(prev => {
      const newY = direction === 'up'
        ? Math.max(0, prev.leftPaddle.y - PADDLE_SPEED)
        : Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.leftPaddle.y + PADDLE_SPEED);

      return {
        ...prev,
        leftPaddle: { y: newY }
      };
    });

    // Also send to server for multiplayer sync
    if (gameState.gameId) {
      sendMessage('player_move', {
        direction,
        gameId: gameState.gameId,
        timestamp: Date.now()
      });
    }
  };

  const move = (direction: string) => {
    if (gameState.gameId) {
      sendMessage('player_move', {
        direction,
        gameId: gameState.gameId,
        timestamp: Date.now()
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🏓 ft_transcendence Pong</h1>
          <p className="text-purple-300">Classic Pong Game with WebSocket Multiplayer</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connection Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
              <div className="flex items-center gap-2 mb-4">
                <Radio className={connected ? "text-green-400" : "text-gray-400"} size={20} />
                <h2 className="text-xl font-bold text-white">Connection</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-purple-300 mb-1 block">User ID</label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    disabled={connected}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded text-white text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm text-purple-300 mb-1 block">WebSocket URL</label>
                  <input
                    type="text"
                    value={wsUrl}
                    onChange={(e) => setWsUrl(e.target.value)}
                    disabled={connected}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded text-white text-sm"
                  />
                </div>

                {!connected ? (
                  <button
                    onClick={connect}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded font-semibold transition"
                  >
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={disconnect}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded font-semibold transition"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Stats Panel */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="text-purple-400" size={20} />
                <h2 className="text-xl font-bold text-white">Server Stats</h2>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Active Connections</span>
                  <span className="text-white font-bold">{stats.activeConnections}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Game Sessions</span>
                  <span className="text-white font-bold">{stats.gameSessions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Queue Size</span>
                  <span className="text-white font-bold">{stats.matchmakingQueue}</span>
                </div>
              </div>
            </div>

            {/* Game State */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
              <div className="flex items-center gap-2 mb-4">
                <Gamepad2 className="text-purple-400" size={20} />
                <h2 className="text-xl font-bold text-white">Game State</h2>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {gameState.inQueue && (
                    <Clock className="text-yellow-400 animate-pulse" size={16} />
                  )}
                  <span className="text-purple-300 text-sm">Status:</span>
                  <span className="text-white font-semibold">
                    {gameState.inGame ? 'In Game' : gameState.inQueue ? 'In Queue' : 'Idle'}
                  </span>
                </div>

                {gameState.gameId && (
                  <div>
                    <span className="text-purple-300 text-sm block mb-1">Game ID:</span>
                    <span className="text-white text-xs font-mono bg-white/5 px-2 py-1 rounded block break-all">
                      {gameState.gameId}
                    </span>
                  </div>
                )}

                {gameState.opponentIsBot && (
                  <div className="flex items-center gap-2 bg-purple-500/20 px-3 py-2 rounded">
                    <Bot className="text-purple-400" size={16} />
                    <span className="text-purple-200 text-sm">Playing vs Bot</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Control Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Matchmaking Controls */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
              <div className="flex items-center gap-2 mb-4">
                <Users className="text-purple-400" size={20} />
                <h2 className="text-xl font-bold text-white">Matchmaking</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={joinMatchmaking}
                  disabled={!connected || gameState.inQueue || gameState.inGame}
                  className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded font-semibold transition"
                >
                  Join Queue
                </button>
                <button
                  onClick={leaveMatchmaking}
                  disabled={!connected || !gameState.inQueue}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded font-semibold transition"
                >
                  Leave Queue
                </button>
              </div>

              {gameState.inQueue && (
                <div className="mt-4 text-center text-purple-300 text-sm">
                  <Clock className="inline mr-2 animate-pulse" size={16} />
                  Waiting for opponent... (Bot will join after 10 seconds)
                </div>
              )}
            </div>

            {/* Game Controls */}
                        {/* Pong Game Canvas */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20 col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Gamepad2 className="text-purple-400" size={20} />
                <h2 className="text-xl font-bold text-white">Pong Game</h2>
                {gameState.opponentIsBot && (
                  <div className="ml-auto flex items-center gap-1 text-orange-400">
                    <Bot size={16} />
                    <span className="text-sm">vs Bot</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {gameState.inGame ? (
                  <div className="flex flex-col items-center">
                    <canvas
                      ref={canvasRef}
                      width={CANVAS_WIDTH}
                      height={CANVAS_HEIGHT}
                      className="border-2 border-purple-400 bg-black rounded-lg"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                    <div className="mt-4 text-center">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <button
                          onClick={() => movePaddle('up')}
                          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded font-semibold transition"
                        >
                          ↑ Move Up (W)
                        </button>
                        <button
                          onClick={() => movePaddle('down')}
                          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded font-semibold transition"
                        >
                          ↓ Move Down (S)
                        </button>
                      </div>
                      <div className="flex justify-center gap-4">
                        <button
                          onClick={() => setPongState(prev => ({ ...prev, gameStarted: true }))}
                          disabled={pongState.gameStarted}
                          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-2 px-4 rounded font-semibold transition"
                        >
                          <Play size={16} className="inline mr-1" />
                          Start Game (SPACE)
                        </button>
                        <button
                          onClick={() => setPongState(prev => ({ ...prev, isPaused: !prev.isPaused }))}
                          disabled={!pongState.gameStarted}
                          className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-white py-2 px-4 rounded font-semibold transition"
                        >
                          {pongState.isPaused ? <Play size={16} className="inline mr-1" /> : <Pause size={16} className="inline mr-1" />}
                          {pongState.isPaused ? 'Resume' : 'Pause'}
                        </button>
                      </div>
                      <p className="text-purple-300 text-sm mt-2">
                        Use W/S or Arrow Keys to control your paddle (left side)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-black/30 rounded-lg p-8 mb-4">
                      <Gamepad2 className="mx-auto text-purple-400 mb-4" size={48} />
                      <h3 className="text-white font-semibold mb-2">Ready to Play Pong?</h3>
                      <p className="text-purple-300 text-sm">Connect and join matchmaking to start playing!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Message Log */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">Message Log</h2>

              <div className="bg-black/30 rounded p-4 h-64 overflow-y-auto font-mono text-sm">
                {messages.map((msg, idx) => (
                  <div key={idx} className="mb-2">
                    <span className="text-gray-400">[{msg.timestamp}]</span>
                    <span className={`ml-2 font-semibold ${
                      msg.type === 'sent' ? 'text-green-400' :
                      msg.type === 'received' ? 'text-blue-400' :
                      msg.type === 'error' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {msg.type.toUpperCase()}:
                    </span>
                    <pre className="text-gray-300 mt-1 whitespace-pre-wrap break-words">
                      {typeof msg.data === 'object' ? JSON.stringify(msg.data, null, 2) : msg.data}
                    </pre>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

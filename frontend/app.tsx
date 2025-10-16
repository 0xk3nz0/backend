import React, { useState, useEffect, useRef } from 'react';
import { Users, Gamepad2, Radio, Activity, Clock, Bot } from 'lucide-react';

export default function GameTester() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState('');
  const [wsUrl, setWsUrl] = useState('ws://localhost:3000/ws');
  const [messages, setMessages] = useState<Array<{ type: string; data: any; timestamp: string }>>([]);
  const [gameState, setGameState] = useState({
    inQueue: false,
    inGame: false,
    gameId: null as string | null,
    opponentIsBot: false,
    queuePosition: null as number | null,
    queueSize: null as number | null
  });
  const [stats, setStats] = useState({
    activeConnections: 0,
    gameSessions: 0,
    matchmakingQueue: 0
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserId(`player-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

        // Send authentication
        socket.send(JSON.stringify({
          type: 'auth',
          payload: { userId }
        }));
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        addMessage('received', message);

        // Handle different message types
        switch(message.type) {
          case 'game_matched':
            setGameState({
              inQueue: false,
              inGame: true,
              gameId: message.payload.id,
              opponentIsBot: message.payload.opponentIsBot,
              queuePosition: null,
              queueSize: null
            });
            break;
          case 'game_start':
            addMessage('system', 'Game started!');
            break;
          case 'player_moved':
            // Movement updates
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

      socket.onerror = () => {
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
            <h1 className="text-4xl font-bold text-white mb-2">Game Backend Tester</h1>
            <p className="text-purple-300">WebSocket Game Testing Interface</p>
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
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">Game Controls</h2>

              <div className="space-y-4">
                <button
                  onClick={sendReady}
                  disabled={!gameState.inGame}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded font-semibold transition"
                >
                  Send Ready Signal
                </button>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => move('up')}
                    disabled={!gameState.inGame}
                    className="w-20 h-12 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-bold transition"
                  >
                    ↑
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => move('left')}
                      disabled={!gameState.inGame}
                      className="w-20 h-12 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-bold transition"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => move('down')}
                      disabled={!gameState.inGame}
                      className="w-20 h-12 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-bold transition"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => move('right')}
                      disabled={!gameState.inGame}
                      className="w-20 h-12 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-bold transition"
                    >
                      →
                    </button>
                  </div>
                </div>
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

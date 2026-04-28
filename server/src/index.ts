import { Server } from '@colyseus/core';
import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'node:http';
import { GameRoom } from './GameRoom';

const port = Number(process.env.PORT ?? 2567);
const redisUrl = process.env.REDIS_URL;
const publicAddress = process.env.PUBLIC_ADDRESS;

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('GTA-threejs Colyseus server\n');
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  gracefullyShutdown: false,
  ...(redisUrl
    ? {
        presence: new RedisPresence(redisUrl),
        driver: new RedisDriver(redisUrl),
      }
    : {}),
  ...(publicAddress ? { publicAddress } : {}),
});

gameServer.define('game', GameRoom);

gameServer.listen(port).then(() => {
  console.log(`Colyseus listening on ws://localhost:${port}`);
  if (redisUrl) console.log('[scale] Redis presence/driver enabled');
  if (publicAddress) console.log(`[scale] publicAddress=${publicAddress}`);
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[server] ${signal} received, shutting down...`);
  const forceExit = setTimeout(() => {
    console.warn('[server] graceful shutdown timed out; forcing exit');
    process.exit(0);
  }, 3000);
  forceExit.unref();

  try {
    await gameServer.gracefullyShutdown(false);
  } catch (error) {
    console.error('[server] shutdown error:', error);
  } finally {
    httpServer.close(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  }
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
process.once('SIGUSR2', shutdown);

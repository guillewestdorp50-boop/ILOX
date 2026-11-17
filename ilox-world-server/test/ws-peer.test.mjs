import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { acceptWebSocket } from '../ws-peer.mjs';

test('accepts a browser WebSocket and parses masked text frames', async () => {
  const server = createServer();
  server.on('upgrade', (req, socket, head) => {
    const peer = acceptWebSocket(req, socket, head);
    peer.on('message', raw => peer.send(`echo:${raw.toString()}`));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const client = new globalThis.WebSocket(`ws://127.0.0.1:${port}/world`);
  try {
    const response = await new Promise((resolve, reject) => {
      client.addEventListener('open', () => client.send('hello'));
      client.addEventListener('message', event => resolve(event.data), { once: true });
      client.addEventListener('error', reject, { once: true });
      setTimeout(() => reject(new Error('WebSocket test timed out')), 3000).unref();
    });
    assert.equal(response, 'echo:hello');
  } finally {
    client.close();
    await new Promise(resolve => server.close(resolve));
  }
});

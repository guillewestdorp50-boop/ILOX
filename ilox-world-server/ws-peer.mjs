import { createHash } from 'node:crypto';

const OPEN = 1;
const MAX_FRAME = 16 * 1024;

function frame(opcode, data = Buffer.alloc(0)) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

export function acceptWebSocket(req, socket, head = Buffer.alloc(0)) {
  const key = req.headers['sec-websocket-key'];
  if (req.headers.upgrade?.toLowerCase() !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return null;
  }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n'
  ].join('\r\n'));
  return new WebSocketPeer(socket, head);
}

class WebSocketPeer {
  constructor(socket, head) {
    this.socket = socket;
    this.readyState = OPEN;
    this.buffer = Buffer.alloc(0);
    this.isAlive = true;
    this.handlers = new Map();
    socket.on('data', chunk => this.consume(chunk));
    socket.on('close', () => { this.readyState = 3; this.emit('close'); });
    socket.on('error', error => this.emit('error', error));
    if (head?.length) this.consume(head);
  }
  on(name, callback) {
    const handlers = this.handlers.get(name) || [];
    handlers.push(callback);
    this.handlers.set(name, handlers);
    return this;
  }
  emit(name, value) { for (const callback of this.handlers.get(name) || []) callback(value); }
  send(value) {
    if (this.readyState === OPEN) this.socket.write(frame(1, Buffer.from(String(value))));
  }
  ping() { if (this.readyState === OPEN) this.socket.write(frame(9)); }
  close(code = 1000, reason = '') {
    if (this.readyState !== OPEN) return;
    this.readyState = 2;
    const text = Buffer.from(String(reason).slice(0, 100));
    const payload = Buffer.alloc(2 + text.length);
    payload.writeUInt16BE(code, 0);
    text.copy(payload, 2);
    this.socket.end(frame(8, payload));
  }
  terminate() { this.readyState = 3; this.socket.destroy(); }
  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0], second = this.buffer[1];
      const opcode = first & 0x0f, masked = !!(second & 0x80);
      let length = second & 0x7f, offset = 2;
      if (!(first & 0x80) || !masked) return this.close(1002, 'invalid frame');
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2); offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        const big = this.buffer.readBigUInt64BE(2);
        if (big > BigInt(MAX_FRAME)) return this.close(1009, 'message too large');
        length = Number(big); offset = 10;
      }
      if (length > MAX_FRAME) return this.close(1009, 'message too large');
      if (this.buffer.length < offset + 4 + length) return;
      const mask = this.buffer.subarray(offset, offset + 4); offset += 4;
      const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      this.buffer = this.buffer.subarray(offset + length);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      if (opcode === 1) this.emit('message', payload);
      else if (opcode === 8) { this.close(1000, 'closed'); return; }
      else if (opcode === 9) this.socket.write(frame(10, payload));
      else if (opcode === 10) { this.isAlive = true; this.emit('pong'); }
      else return this.close(1003, 'unsupported frame');
    }
  }
}

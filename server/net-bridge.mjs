// WebSocket to TCP bridge for Retro WFC.
import { WebSocketServer } from 'ws';
import net from 'node:net';
const PORT = process.env.NET_PORT || 8788;
const RWFC_HOSTS = new Set([
  'rwfc.net', 'nas.rwfc.net', 'gpcm.rwfc.net', 'gpsp.rwfc.net', 'dls.rwfc.net',
  'nas.wiilink24.com', 'gpcm.wiilink24.com', 'gpsp.wiilink24.com', 'dls.wiilink24.com',
]);
const RWFC_PORTS = new Set([28910, 29900, 29901, 29920]);
const wss = new WebSocketServer({ port: PORT, path: '/rwfc' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const host = url.searchParams.get('host');
  const port = parseInt(url.searchParams.get('port') || '0', 10);
  if (!host || !port) { ws.close(1008, 'missing host/port'); return; }
  const allowHost = [...RWFC_HOSTS].some((h) => host === h || host.endsWith('.' + h));
  if (!allowHost) { ws.close(1008, 'host not allowed: ' + host); return; }
  if (!RWFC_PORTS.has(port)) { ws.close(1008, 'port not allowed: ' + port); return; }
  const tcp = net.connect({ host, port }, () => {
    console.log('[rwfc-bridge] ' + host + ':' + port + ' connected');
  });
  ws.on('message', (data) => { if (tcp.writable) tcp.write(Buffer.from(data)); });
  tcp.on('data', (chunk) => { if (ws.readyState === ws.OPEN) ws.send(chunk); });
  const cleanup = () => { try { tcp.destroy(); } catch {} try { ws.close(); } catch {} };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
  tcp.on('close', cleanup);
  tcp.on('error', (e) => { console.warn('[rwfc-bridge] tcp error: ' + e.message); cleanup(); });
});
console.log('[rwfc-bridge] listening on ws://localhost:' + PORT + '/rwfc');
console.log('[rwfc-bridge] allowed hosts: ' + [...RWFC_HOSTS].join(', '));
console.log('[rwfc-bridge] allowed ports: ' + [...RWFC_PORTS].join(', '));
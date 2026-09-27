import { WebSocketServer } from 'ws';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PORT = Number(process.env.KILOSSK_WS_PORT || 8787);
const wss = new WebSocketServer({ port: PORT });
let browser = null;
const pending = new Map();
let seq = 1;

wss.on('connection', (ws, req) => {
  if (req.url !== '/browser') return ws.close(1008, 'Use /browser');
  browser = ws;
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (msg.type === 'tool_result' && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      clearTimeout(p.timer);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result);
    }
  });
  ws.on('close', () => { if (browser === ws) browser = null; });
});

function callBrowser(name, args = {}) {
  return new Promise((resolve, reject) => {
    if (!browser || browser.readyState !== 1) return reject(new Error('Kilossk browser is not connected'));
    const id = String(seq++);
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Painter tool timeout'));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    browser.send(JSON.stringify({ type: 'tool', id, name, args }));
  });
}

const mcp = new McpServer({ name: 'kilossk-painter', version: '0.1.0' });
const out = data => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

mcp.tool('canvas_snapshot', 'Get current composited canvas and all three layers as PNG data URLs.', {}, async () => out(await callBrowser('canvas_snapshot')));
mcp.tool('stroke', 'Draw one black line on the AI layer.', {
  x1:z.number(), y1:z.number(), x2:z.number(), y2:z.number(),
  width:z.number().optional(), opacity:z.number().optional()
}, async a => out(await callBrowser('stroke', a)));
mcp.tool('polyline', 'Draw a black polyline on the AI layer.', {
  points:z.array(z.object({x:z.number(),y:z.number()})).min(2),
  width:z.number().optional(), opacity:z.number().optional(), closed:z.boolean().optional()
}, async a => out(await callBrowser('polyline', a)));
mcp.tool('dot', 'Draw a black dot on the AI layer.', {
  x:z.number(), y:z.number(), radius:z.number().optional(), opacity:z.number().optional()
}, async a => out(await callBrowser('dot', a)));
mcp.tool('erase', 'Erase a path only from the AI layer.', {
  points:z.array(z.object({x:z.number(),y:z.number()})).min(2), width:z.number().optional()
}, async a => out(await callBrowser('erase', a)));
mcp.tool('clear_ai', 'Clear only the AI layer.', {}, async () => out(await callBrowser('clear_ai')));
mcp.tool('batch', 'Execute many Painter actions on the AI layer.', {
  actions:z.array(z.object({
    tool:z.enum(['stroke','polyline','dot','erase']),
    args:z.record(z.any())
  })).max(600)
}, async a => out(await callBrowser('batch', a)));

console.error('Kilossk browser bridge ws://localhost:' + PORT + '/browser');
await mcp.connect(new StdioServerTransport());

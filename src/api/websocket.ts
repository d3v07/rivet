import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { logInfo } from '@/lib/logger';

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: http.Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    logInfo('WebSocket client connected', { correlationId: 'ws' });

    ws.on('close', () => {
      logInfo('WebSocket client disconnected', { correlationId: 'ws' });
    });
  });

  return wss;
}

export function broadcastPipelineEvent(event: {
  type: 'stage_update' | 'pipeline_complete' | 'pipeline_failed';
  issueKey: string;
  stage?: string;
  status?: string;
  data?: unknown;
}) {
  if (!wss) return;

  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

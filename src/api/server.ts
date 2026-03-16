import express from 'express';
import cors from 'cors';
import http from 'http';
import { pipelinesRouter } from '@/api/routes/pipelines';
import { backlogRouter } from '@/api/routes/backlog';
import { securityRouter } from '@/api/routes/security';
import { pbomRouter } from '@/api/routes/pbom';
import { carbonRouter } from '@/api/routes/carbon';
import { analyticsRouter } from '@/api/routes/analytics';
import { chatRouter } from '@/api/routes/chat';
import { auditRouter } from '@/api/routes/audit';
import { healthRouter } from '@/api/routes/health';
import { pricingRouter } from '@/api/routes/pricing';
import { logInfo } from '@/lib/logger';
import { setupWebSocket } from '@/api/websocket';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:8080',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/pipelines', pipelinesRouter);
  app.use('/api/backlog', backlogRouter);
  app.use('/api/security', securityRouter);
  app.use('/api/pbom', pbomRouter);
  app.use('/api/carbon', carbonRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/pricing', pricingRouter);

  return app;
}

export function startServer(port = 3001) {
  const app = createApp();
  const server = http.createServer(app);
  const wss = setupWebSocket(server);

  server.listen(port, () => {
    logInfo(`Rivet API server running on port ${port}`, { correlationId: 'server-start' });
  });

  return { app, server, wss };
}

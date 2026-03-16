import { startServer } from '@/api/server';

const port = parseInt(process.env.API_PORT || '3001', 10);
startServer(port);

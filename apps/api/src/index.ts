import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { logger } from './lib/logger';

const server = Fastify({
  logger: false,
  maxParamLength: 5000,
});

async function main() {
  // CORS
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        logger.error({ path, error: error.message }, 'tRPC error');
      },
    },
  });

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    logger.info(`Server running at http://${host}:${port}`);
    logger.info(`tRPC endpoint: http://${host}:${port}/trpc`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

main();

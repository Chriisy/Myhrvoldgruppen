import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Database } from '../lib/db';
import { db } from '../lib/db';
import { createChildLogger, type Logger } from '../lib/logger';

export interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  departmentId?: string | null;
}

export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  db: Database;
  log: Logger;
  user: User | null;
  correlationId: string;
}

export async function createContext({
  req,
  res
}: {
  req: FastifyRequest;
  res: FastifyReply;
}): Promise<Context> {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  const log = createChildLogger(correlationId);

  // Auth will be added in auth module
  let user: User | null = null;

  return {
    req,
    res,
    db,
    log,
    user,
    correlationId,
  };
}

export type ContextWithUser = Omit<Context, 'user'> & { user: User };

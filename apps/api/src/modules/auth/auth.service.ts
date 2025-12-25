import { TRPCError } from '@trpc/server';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { Database } from '../../lib/db';
import type { Logger } from '../../lib/logger';
import { users, sessions } from '@myhrvold/db/schema';

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export class AuthService {
  constructor(
    private db: Database,
    private log: Logger
  ) {}

  async login(email: string, password: string, meta: SessionMeta) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user || !user.password) {
      this.log.warn({ email }, 'Login failed: user not found');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Ugyldig e-post eller passord',
      });
    }

    if (!user.isActive) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Kontoen er deaktivert. Kontakt administrator.',
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      this.log.warn({ email }, 'Login failed: invalid password');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Ugyldig e-post eller passord',
      });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    this.log.info({ userId: user.id, email }, 'User logged in');

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        departmentId: user.departmentId,
      },
    };
  }

  async logout(token: string) {
    await this.db.delete(sessions).where(eq(sessions.token, token));
    this.log.info('Session deleted');
    return { success: true };
  }

  async validateToken(token: string) {
    const session = await this.db.query.sessions.findFirst({
      where: and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, new Date())
      ),
      with: {
        user: true,
      },
    });

    if (!session || !session.user) {
      return null;
    }

    if (!session.user.isActive) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
      departmentId: session.user.departmentId,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}

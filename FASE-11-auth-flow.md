# FASE 11: Auth Flow (Login/Logout)

> Fase 1-10 må være fullført.
> Estimert tid: ~30 minutter.

## Mål

Implementer komplett autentiseringsflyt med sessions.

---

## Backend: Auth Router

### apps/api/src/modules/auth/auth.router.ts

```typescript
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../../trpc/trpc';
import { AuthService } from './auth.service';

const loginInput = z.object({
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(6, 'Passord må være minst 6 tegn'),
});

export const authRouter = router({
  // Login
  login: publicProcedure
    .input(loginInput)
    .mutation(async ({ ctx, input }) => {
      const service = new AuthService(ctx.db, ctx.log);
      return service.login(input.email, input.password, {
        userAgent: ctx.req.headers['user-agent'],
        ipAddress: ctx.req.ip,
      });
    }),

  // Logout
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      const token = ctx.req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const service = new AuthService(ctx.db, ctx.log);
        await service.logout(token);
      }
      return { success: true };
    }),

  // Get current user
  me: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.user;
    }),

  // Refresh session
  refresh: protectedProcedure
    .mutation(async ({ ctx }) => {
      const token = ctx.req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return { success: false };
      }
      const service = new AuthService(ctx.db, ctx.log);
      return service.refreshSession(token);
    }),
});

export type AuthRouter = typeof authRouter;
```

---

### apps/api/src/modules/auth/auth.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
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
    // Finn bruker
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

    // Sjekk om bruker er aktiv
    if (!user.isActive) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Kontoen er deaktivert. Kontakt administrator.',
      });
    }

    // Verifiser passord
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      this.log.warn({ email }, 'Login failed: invalid password');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Ugyldig e-post eller passord',
      });
    }

    // Opprett session
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dager

    await this.db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    // Oppdater lastLoginAt
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

  async refreshSession(token: string) {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    await this.db
      .update(sessions)
      .set({ expiresAt: newExpiry })
      .where(eq(sessions.token, token));

    return { success: true, expiresAt: newExpiry };
  }
}
```

---

### Oppdater trpc/context.ts

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Database } from '../lib/db';
import type { Logger } from 'pino';
import { db } from '../lib/db';
import { createChildLogger } from '../lib/logger';
import { AuthService } from '../modules/auth/auth.service';

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
  const correlationId = req.correlationId || 'unknown';
  const log = createChildLogger(correlationId);

  // Parse auth token
  let user: User | null = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const authService = new AuthService(db, log);
    user = await authService.validateToken(token);
  }

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
```

---

### Oppdater trpc/index.ts

```typescript
import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';
import { claimsRouter } from '../modules/claims/claims.router';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,      // <-- Legg til
  claims: claimsRouter,
});

export type AppRouter = typeof appRouter;
```

---

## Frontend: Login Screen

### apps/mobile/app/(auth)/_layout.tsx

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

---

### apps/mobile/app/(auth)/login.tsx

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react-native';

const loginSchema = z.object({
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(6, 'Passord må være minst 6 tegn'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      await setAuth(data.user, data.token);
      router.replace('/(dashboard)');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const onSubmit = (data: LoginForm) => {
    setError(null);
    loginMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-primary"
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-12">
          <Text className="text-4xl font-bold text-white">Myhrvoldgruppen</Text>
          <Text className="text-white/70 mt-2">Service</Text>
        </View>

        {/* Form Card */}
        <View className="bg-white rounded-2xl p-6 shadow-xl">
          <Text className="text-2xl font-bold text-gray-900 mb-6">
            {t('auth.login')}
          </Text>

          {error && (
            <View className="flex-row items-center bg-red-50 p-3 rounded-lg mb-4">
              <AlertCircle size={20} color="#ef4444" />
              <Text className="ml-2 text-red-600 flex-1">{error}</Text>
            </View>
          )}

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg px-3">
              <Mail size={20} color="#9ca3af" />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="flex-1 py-3 px-2 text-gray-900"
                    placeholder="din@epost.no"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
            </View>
            {errors.email && (
              <Text className="text-red-500 text-sm mt-1">{errors.email.message}</Text>
            )}
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg px-3">
              <Lock size={20} color="#9ca3af" />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="flex-1 py-3 px-2 text-gray-900"
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
            </View>
            {errors.password && (
              <Text className="text-red-500 text-sm mt-1">{errors.password.message}</Text>
            )}
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting || loginMutation.isPending}
            className={`flex-row items-center justify-center py-4 rounded-lg ${
              isSubmitting || loginMutation.isPending 
                ? 'bg-primary/50' 
                : 'bg-primary'
            }`}
          >
            <LogIn size={20} color="white" />
            <Text className="ml-2 text-white font-semibold text-lg">
              {isSubmitting || loginMutation.isPending ? 'Logger inn...' : t('auth.login')}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
```

---

## Test

```bash
# Backend
pnpm --filter @myhrvold/api dev

# Frontend
pnpm --filter @myhrvold/mobile dev:web
```

Test login:
```bash
# Opprett testbruker først (i database)
# Deretter test via UI
```

---

## Sjekkliste

- [ ] auth.router.ts med login/logout/me
- [ ] auth.service.ts med password verification
- [ ] Session opprettelse og validering
- [ ] Context oppdatert med auth
- [ ] Login screen med form validation
- [ ] Error handling
- [ ] Token lagring (SecureStore/localStorage)
- [ ] Redirect etter login

---

## Neste fase

Gå til **FASE 12: Claims UI** for reklamasjonsliste og detaljer.

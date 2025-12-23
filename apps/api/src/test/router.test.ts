import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '../trpc/router';
import { createContext } from '../trpc/context';

// Mock database
const mockDb = {
  query: {
    users: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    sessions: {
      findFirst: vi.fn(),
    },
    claims: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn(),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn(),
      }),
    }),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn(),
    }),
  }),
};

// Create mock context
function createMockContext(user?: any) {
  return {
    db: mockDb as any,
    user: user || null,
    session: user ? { id: 'session-id', token: 'test-token' } : null,
  };
}

describe('Health Router', () => {
  it('should return health status', async () => {
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.health.check();

    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
  });
});

describe('Auth Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for unauthenticated user', async () => {
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.auth.me();

    expect(result).toBeNull();
  });

  it('should return user for authenticated user', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'technician',
    };

    const caller = appRouter.createCaller(createMockContext(mockUser));
    const result = await caller.auth.me();

    expect(result).toEqual(mockUser);
  });

  it('should reject login with invalid credentials', async () => {
    mockDb.query.users.findFirst.mockResolvedValue(null);

    const caller = appRouter.createCaller(createMockContext());

    await expect(
      caller.auth.login({ email: 'wrong@example.com', password: 'wrong' })
    ).rejects.toThrow();
  });
});

describe('Claims Router', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'technician',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list claims for authenticated user', async () => {
    const mockClaims = [
      { id: 'claim-1', claimNumber: 'RK-2024-001', status: 'open' },
      { id: 'claim-2', claimNumber: 'RK-2024-002', status: 'in_progress' },
    ];

    mockDb.query.claims.findMany.mockResolvedValue(mockClaims);

    const caller = appRouter.createCaller(createMockContext(mockUser));
    const result = await caller.claims.list({ page: 1, limit: 10 });

    expect(result).toHaveProperty('items');
    expect(result.items).toHaveLength(2);
  });

  it('should get claim by ID', async () => {
    const mockClaim = {
      id: 'claim-1',
      claimNumber: 'RK-2024-001',
      status: 'open',
      productName: 'Test Product',
    };

    mockDb.query.claims.findFirst.mockResolvedValue(mockClaim);

    const caller = appRouter.createCaller(createMockContext(mockUser));
    const result = await caller.claims.byId({ id: 'claim-1' });

    expect(result).toEqual(mockClaim);
  });

  it('should reject unauthenticated access', async () => {
    const caller = appRouter.createCaller(createMockContext());

    await expect(
      caller.claims.list({ page: 1, limit: 10 })
    ).rejects.toThrow();
  });
});

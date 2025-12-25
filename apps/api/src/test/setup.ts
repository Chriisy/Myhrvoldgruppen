import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

// Mock pino logger
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

beforeAll(() => {
  // Setup before all tests
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
});

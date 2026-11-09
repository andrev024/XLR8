import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
  };
  refreshToken: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: MockPrisma;
  let jwtService: JwtService;

  const buildService = () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    jwtService = new JwtService({ secret: 'test-secret' });

    const configService = {
      get: (key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          JWT_REFRESH_EXPIRES_IN_DAYS: '7',
        };
        return values[key] ?? defaultValue;
      },
      getOrThrow: (key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-secret',
        };
        return values[key];
      },
    } as unknown as ConfigService;

    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      configService,
    );
  };

  beforeEach(() => {
    buildService();
  });

  describe('register', () => {
    it('crea un usuario con el password hasheado', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'user-1',
            email: data.email,
            displayName: data.displayName,
            passwordHash: data.passwordHash,
          }),
      );

      const result = await authService.register({
        email: 'test@xlr8.app',
        password: 'password123',
        displayName: 'Test User',
      });

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@xlr8.app',
        displayName: 'Test User',
      });
      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('password123');
      await expect(
        argon2.verify(createArgs.data.passwordHash, 'password123'),
      ).resolves.toBe(true);
    });

    it('lanza ConflictException si el email ya existe', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        authService.register({
          email: 'test@xlr8.app',
          password: 'password123',
          displayName: 'Test User',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('devuelve un par de tokens con credenciales válidas', async () => {
      const passwordHash = await argon2.hash('password123');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@xlr8.app',
        passwordHash,
        displayName: 'Test User',
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.login({
        email: 'test@xlr8.app',
        password: 'password123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('lanza UnauthorizedException con password incorrecto', async () => {
      const passwordHash = await argon2.hash('password123');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@xlr8.app',
        passwordHash,
        displayName: 'Test User',
      });

      await expect(
        authService.login({ email: 'test@xlr8.app', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rota el refresh token y revoca el anterior', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        email: 'test@xlr8.app',
      });

      const result = await authService.refresh('some-refresh-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('revoca todas las sesiones si se reutiliza un token ya revocado', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({});

      await expect(authService.refresh('stolen-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('lanza UnauthorizedException si el token no existe', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        authService.refresh('unknown-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});

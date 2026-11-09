import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Auth + Vehicles flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@xlr8.app`;
  const password = 'password123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.vehicle.deleteMany({
      where: { user: { email } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { email } },
    });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registra, inicia sesión, crea y lista vehículos', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'E2E Rider' })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const { accessToken } = loginResponse.body as { accessToken: string };
    expect(accessToken).toEqual(expect.any(String));

    const createResponse = await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'MOTORCYCLE',
        brand: 'Yamaha',
        model: 'MT-07',
        year: 2023,
        horsepower: 73,
      })
      .expect(201);

    expect(createResponse.body.powerCategory).toBe('MID');

    const listResponse = await request(app.getHttpServer())
      .get('/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(createResponse.body.id);
  });
});

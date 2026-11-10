import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Vehicle catalog (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists brands publicly without a JWT', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog/brands?type=MOTORCYCLE')
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining(['Yamaha', 'Honda', 'AKT']),
    );
  });

  it('filters models and returns version specifications', async () => {
    const modelsResponse = await request(app.getHttpServer())
      .get('/catalog/models?type=MOTORCYCLE&brand=Yamaha')
      .expect(200);
    expect(modelsResponse.body).toEqual(
      expect.arrayContaining(['FZ', 'MT-07']),
    );

    const modelSamples = [
      {
        type: 'MOTORCYCLE',
        brand: 'Yamaha',
        model: 'FZ',
        versions: [
          expect.objectContaining({
            version: '2.0 (149 cc)',
            yearFrom: 2015,
            yearTo: 2021,
            horsepower: 13,
            source: 'Ficha técnica Yamaha FZ 2.0 Colombia',
          }),
          expect.objectContaining({
            version: 'Versión 3.0 (149 cc)',
            yearFrom: 2027,
            yearTo: null,
            horsepower: 12,
            source: 'Ficha oficial Incolmotos Yamaha FZ 3.0 2027',
          }),
        ],
      },
      {
        type: 'MOTORCYCLE',
        brand: 'AKT',
        model: 'NKD 125',
        versions: [
          expect.objectContaining({ version: 'Estándar (124 cc)' }),
          expect.objectContaining({ version: 'FP (124 cc)' }),
          expect.objectContaining({ version: 'Classic (124 cc)' }),
        ],
      },
      {
        type: 'CAR',
        brand: 'Chevrolet',
        model: 'Onix',
        versions: [
          expect.objectContaining({ version: 'Sedán LT MT 1.0 Turbo' }),
          expect.objectContaining({ version: 'Sedán LT AT 1.0 Turbo' }),
          expect.objectContaining({ version: 'Sedán LTZ AT 1.0 Turbo' }),
          expect.objectContaining({ version: 'Sedán Premier AT 1.0 Turbo' }),
        ],
      },
      {
        type: 'CAR',
        brand: 'Kia',
        model: 'Picanto',
        versions: [
          expect.objectContaining({ version: 'Vibrant MT (1.0L)' }),
          expect.objectContaining({ version: 'Zenith MT (1.25L)' }),
          expect.objectContaining({ version: 'Zenith AT (1.25L)' }),
          expect.objectContaining({ version: 'GT Line (1.25L)' }),
        ],
      },
    ];

    for (const sample of modelSamples) {
      const response = await request(app.getHttpServer())
        .get(
          `/catalog/versions?type=${sample.type}&brand=${encodeURIComponent(sample.brand)}&model=${encodeURIComponent(sample.model)}`,
        )
        .expect(200);

      expect(response.body).toEqual(expect.arrayContaining(sample.versions));
    }
  });

  it('rejects invalid vehicle types', async () => {
    await request(app.getHttpServer())
      .get('/catalog/brands?type=BOAT')
      .expect(400);
  });
});

import { VehicleType } from '../../generated/prisma';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const service = new CatalogService();

  it('provides at least ten models for every catalog brand', () => {
    for (const type of [VehicleType.MOTORCYCLE, VehicleType.CAR]) {
      for (const brand of service.findBrands(type)) {
        expect(service.findModels(type, brand).length).toBeGreaterThanOrEqual(
          10,
        );
      }
    }
  });

  it('lists at least 25 motorcycle and car brands/models in the catalog', () => {
    const motorcycleModels = service
      .findBrands(VehicleType.MOTORCYCLE)
      .flatMap((brand) => service.findModels(VehicleType.MOTORCYCLE, brand));
    const carModels = service
      .findBrands(VehicleType.CAR)
      .flatMap((brand) => service.findModels(VehicleType.CAR, brand));

    expect(motorcycleModels.length).toBeGreaterThanOrEqual(25);
    expect(carModels.length).toBeGreaterThanOrEqual(25);
  });

  it('returns unique sorted brands and filters models by type and brand', () => {
    expect(service.findBrands(VehicleType.MOTORCYCLE)).toEqual(
      expect.arrayContaining(['Yamaha', 'Honda', 'AKT', 'Royal Enfield']),
    );
    expect(service.findModels(VehicleType.MOTORCYCLE, 'Yamaha')).toContain(
      'FZ',
    );
    expect(service.findModels(VehicleType.CAR, 'Yamaha')).toEqual([]);
  });

  it('returns version years and horsepower without internal catalog fields', () => {
    expect(
      service.findVersions(VehicleType.MOTORCYCLE, 'Yamaha', 'FZ'),
    ).toEqual(
      expect.arrayContaining([
        {
          version: '2.0 (149 cc)',
          yearFrom: 2015,
          yearTo: 2021,
          horsepower: 13,
          source: 'Ficha técnica Yamaha FZ 2.0 Colombia',
        },
        {
          version: 'Versión 3.0 (149 cc)',
          yearFrom: 2027,
          yearTo: null,
          horsepower: 12,
          source: 'Ficha oficial Incolmotos Yamaha FZ 3.0 2027',
        },
      ]),
    );
  });

  it('lists current official variants for popular Colombian models', () => {
    const aktVersions = service.findVersions(
      VehicleType.MOTORCYCLE,
      'AKT',
      'NKD 125',
    );
    expect(aktVersions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ version: 'Estándar (124 cc)' }),
        expect.objectContaining({ version: 'FP (124 cc)' }),
        expect.objectContaining({ version: 'Classic (124 cc)' }),
      ]),
    );

    const onixVersions = service.findVersions(
      VehicleType.CAR,
      'Chevrolet',
      'Onix',
    );
    expect(onixVersions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          version: 'Sedán LT MT 1.0 Turbo',
          yearFrom: 2027,
          horsepower: 115,
        }),
        expect.objectContaining({
          version: 'Sedán Premier AT 1.0 Turbo',
          yearFrom: 2027,
          horsepower: 115,
        }),
      ]),
    );

    const picantoVersions = service.findVersions(
      VehicleType.CAR,
      'Kia',
      'Picanto',
    );
    expect(picantoVersions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          version: 'Vibrant MT (1.0L)',
          yearFrom: 2026,
          horsepower: 66,
        }),
        expect.objectContaining({
          version: 'Zenith AT (1.25L)',
          yearFrom: 2026,
          horsepower: 83,
        }),
        expect.objectContaining({
          version: 'GT Line (1.25L)',
          yearFrom: 2026,
          horsepower: 83,
        }),
      ]),
    );
  });

  it('lists additional models without claiming unverified technical data', () => {
    expect(service.findBrands(VehicleType.MOTORCYCLE)).toContain('Hero');
    expect(service.findModels(VehicleType.MOTORCYCLE, 'Hero')).toContain(
      'XPulse 200 4V',
    );
    expect(
      service.findVersions(VehicleType.MOTORCYCLE, 'Hero', 'XPulse 200 4V'),
    ).toEqual([]);
    expect(service.findBrands(VehicleType.CAR)).toContain('BYD');
    expect(service.findModels(VehicleType.CAR, 'BYD')).toContain('Dolphin');
  });

  it('does not imply technical versions for supplemental model names', () => {
    expect(service.findVersions(VehicleType.CAR, 'Audi', 'A4')).toEqual([]);
  });
});

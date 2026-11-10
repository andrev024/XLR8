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
    ).toEqual([
      {
        version: '2.0 (149 cc)',
        yearFrom: 2015,
        yearTo: 2021,
        horsepower: 13,
        source: 'Ficha técnica Yamaha FZ 2.0 Colombia',
      },
    ]);
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

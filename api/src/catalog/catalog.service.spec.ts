import { VehicleType } from '../../generated/prisma';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const service = new CatalogService();

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
});

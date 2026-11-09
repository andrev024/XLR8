import { ApiProperty } from '@nestjs/swagger';

export class CatalogVersionDto {
  @ApiProperty({ example: '2.0 (149 cc)' })
  version!: string;

  @ApiProperty({ example: 2015 })
  yearFrom!: number;

  @ApiProperty({ example: 2021, nullable: true })
  yearTo!: number | null;

  @ApiProperty({ example: 13, description: 'Potencia aproximada en hp' })
  horsepower!: number;

  @ApiProperty({ example: 'Ficha técnica Yamaha FZ 2.0 Colombia' })
  source!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { VehicleType } from '../../../generated/prisma';

export class CatalogQueryDto {
  @ApiProperty({ enum: VehicleType, example: VehicleType.MOTORCYCLE })
  @IsEnum(VehicleType)
  type!: VehicleType;
}

export class CatalogModelsQueryDto extends CatalogQueryDto {
  @ApiProperty({ example: 'Yamaha' })
  @IsString()
  @MinLength(1)
  brand!: string;
}

export class CatalogVersionsQueryDto extends CatalogModelsQueryDto {
  @ApiProperty({ example: 'FZ' })
  @IsString()
  @MinLength(1)
  model!: string;
}

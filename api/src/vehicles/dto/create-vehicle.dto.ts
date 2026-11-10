import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VehicleType } from '../../../generated/prisma';

export class CreateVehicleDto {
  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  type!: VehicleType;

  @ApiProperty({ example: 'Yamaha' })
  @IsString()
  @MinLength(1)
  brand!: string;

  @ApiProperty({ example: 'MT-07' })
  @IsString()
  @MinLength(1)
  model!: string;

  @ApiProperty({ example: 2023 })
  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 73 })
  @IsInt()
  @Min(1)
  horsepower!: number;

  @ApiProperty({ required: false, example: 689 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  engineDisplacementCc?: number;

  @ApiProperty({ required: false, example: '4 tiempos, bicilíndrico' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  engineType?: string;

  @ApiProperty({ required: false, example: 184 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5000)
  weightKg?: number;

  @ApiProperty({ required: false, example: 4.5 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  fuelConsumptionLitersPer100Km?: number;
}

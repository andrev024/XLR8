import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  Max,
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
}

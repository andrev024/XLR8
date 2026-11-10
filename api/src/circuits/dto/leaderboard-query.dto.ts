import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PowerCategory, VehicleType } from '../../../generated/prisma';

export enum LeaderboardPeriod {
  ALL_TIME = 'ALL_TIME',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export class LeaderboardQueryDto {
  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @ApiProperty({ enum: PowerCategory })
  @IsEnum(PowerCategory)
  powerCategory!: PowerCategory;

  @ApiPropertyOptional({
    enum: LeaderboardPeriod,
    default: LeaderboardPeriod.ALL_TIME,
  })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period?: LeaderboardPeriod;
}

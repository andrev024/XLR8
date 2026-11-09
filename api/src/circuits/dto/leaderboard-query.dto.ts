import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PowerCategory, VehicleType } from '../../../generated/prisma';

export class LeaderboardQueryDto {
  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @ApiProperty({ enum: PowerCategory })
  @IsEnum(PowerCategory)
  powerCategory!: PowerCategory;
}

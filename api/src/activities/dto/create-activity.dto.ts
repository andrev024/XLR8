import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTrackPointDto {
  @ApiProperty({ example: 4.711 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: -74.0432 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({ example: '2026-10-05T10:00:00.000Z' })
  @IsDateString()
  recordedAt!: string;

  @ApiProperty({ required: false, example: 12.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speedMs?: number;

  @ApiProperty({ required: false, example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}

export class CreateActivityDto {
  @ApiProperty()
  @IsUUID()
  vehicleId!: string;

  @ApiProperty({ example: '2026-10-05T10:00:00.000Z' })
  @IsDateString()
  startedAt!: string;

  @ApiProperty({ example: '2026-10-05T10:30:00.000Z' })
  @IsDateString()
  endedAt!: string;

  @ApiProperty({ type: [CreateTrackPointDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20000)
  @ValidateNested({ each: true })
  @Type(() => CreateTrackPointDto)
  points!: CreateTrackPointDto[];
}

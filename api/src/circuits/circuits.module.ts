import { Module } from '@nestjs/common';
import { CircuitsController } from './circuits.controller';
import { CircuitsService } from './circuits.service';
import { CircuitAttemptsDetectorService } from './circuit-attempts-detector.service';

@Module({
  controllers: [CircuitsController],
  providers: [CircuitsService, CircuitAttemptsDetectorService],
  exports: [CircuitAttemptsDetectorService],
})
export class CircuitsModule {}

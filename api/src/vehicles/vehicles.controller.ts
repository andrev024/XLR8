import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import type { Vehicle } from '../../generated/prisma';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un vehículo del usuario autenticado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los vehículos del usuario autenticado' })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<Vehicle[]> {
    return this.vehiclesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un vehículo propio por id' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Vehicle> {
    return this.vehiclesService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un vehículo propio' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un vehículo propio sin actividades' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.vehiclesService.remove(user.id, id);
  }
}

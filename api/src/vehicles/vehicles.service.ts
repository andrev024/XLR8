import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { calculatePowerCategory } from './power-category';
import type { Vehicle } from '../../generated/prisma';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    return this.prisma.vehicle.create({
      data: {
        userId,
        type: dto.type,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        horsepower: dto.horsepower,
        powerCategory: calculatePowerCategory(dto.type, dto.horsepower),
      },
    });
  }

  findAll(userId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({ where: { userId } });
  }

  async findOne(userId: string, id: string): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, userId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    return vehicle;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    const existing = await this.findOne(userId, id);

    const type = dto.type ?? existing.type;
    const horsepower = dto.horsepower ?? existing.horsepower;
    const shouldRecalculate =
      dto.type !== undefined || dto.horsepower !== undefined;

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...dto,
        ...(shouldRecalculate
          ? { powerCategory: calculatePowerCategory(type, horsepower) }
          : {}),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);

    const activitiesCount = await this.prisma.activity.count({
      where: { vehicleId: id },
    });
    if (activitiesCount > 0) {
      throw new ConflictException(
        'No se puede eliminar un vehículo con actividades asociadas',
      );
    }

    await this.prisma.vehicle.delete({ where: { id } });
  }
}

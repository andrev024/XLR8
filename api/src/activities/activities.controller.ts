import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import {
  ActivitiesService,
  type ActivityCreationResult,
  type ActivityDetail,
  type PaginatedActivities,
} from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ListActivitiesQueryDto } from './dto/list-activities-query.dto';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @ApiOperation({
    summary: 'Sube una actividad con su ruta GPS y detecta intentos de circuito',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateActivityDto,
  ): Promise<ActivityCreationResult> {
    return this.activitiesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista mis actividades, más recientes primero' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListActivitiesQueryDto,
  ): Promise<PaginatedActivities> {
    return this.activitiesService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una actividad con su ruta simplificada' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ActivityDetail> {
    return this.activitiesService.findOne(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una actividad propia' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.activitiesService.remove(user.id, id);
  }
}

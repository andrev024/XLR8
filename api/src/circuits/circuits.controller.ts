import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import {
  CircuitsService,
  type CircuitDetail,
  type CircuitListItem,
  type LeaderboardEntry,
  type MyLeaderboardSummary,
  type MyAttemptEntry,
} from './circuits.service';
import { NearbyCircuitsQueryDto } from './dto/nearby-circuits-query.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@ApiTags('circuits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('circuits')
export class CircuitsController {
  constructor(private readonly circuitsService: CircuitsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista circuitos, opcionalmente filtrados por cercanía',
  })
  findAll(@Query() query: NearbyCircuitsQueryDto): Promise<CircuitListItem[]> {
    return this.circuitsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un circuito con su geometría' })
  findOne(@Param('id') id: string): Promise<CircuitDetail> {
    return this.circuitsService.findOne(id);
  }

  @Get(':id/leaderboard')
  @ApiOperation({
    summary: 'Top 3 de mejores tiempos por tipo y categoría de potencia',
  })
  leaderboard(
    @Param('id') id: string,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardEntry[]> {
    return this.circuitsService.leaderboard(id, query);
  }

  @Get(':id/leaderboard/me')
  @ApiOperation({
    summary: 'Mejor tiempo válido y posición del usuario en la categoría',
  })
  myLeaderboardSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: LeaderboardQueryDto,
  ): Promise<MyLeaderboardSummary> {
    return this.circuitsService.myLeaderboardSummary(id, user.id, query);
  }

  @Get(':id/my-attempts')
  @ApiOperation({ summary: 'Mis intentos en un circuito' })
  myAttempts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MyAttemptEntry[]> {
    return this.circuitsService.myAttempts(id, user.id);
  }
}

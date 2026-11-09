import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { VehicleType } from '../../generated/prisma';
import { CatalogService } from './catalog.service';
import {
  CatalogModelsQueryDto,
  CatalogQueryDto,
  CatalogVersionsQueryDto,
} from './dto/catalog-query.dto';
import { CatalogVersionDto } from './dto/catalog-version.dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('brands')
  @ApiOperation({
    summary: 'Lista las marcas disponibles por tipo de vehículo',
  })
  @ApiQuery({ name: 'type', enum: VehicleType })
  @ApiOkResponse({
    description: 'Marcas ordenadas alfabéticamente',
    type: [String],
  })
  findBrands(@Query() query: CatalogQueryDto): string[] {
    return this.catalogService.findBrands(query.type);
  }

  @Get('models')
  @ApiOperation({ summary: 'Lista los modelos de una marca y tipo' })
  @ApiQuery({ name: 'type', enum: VehicleType })
  @ApiQuery({ name: 'brand', example: 'Yamaha' })
  @ApiOkResponse({
    description: 'Modelos ordenados alfabéticamente',
    type: [String],
  })
  findModels(@Query() query: CatalogModelsQueryDto): string[] {
    return this.catalogService.findModels(query.type, query.brand);
  }

  @Get('versions')
  @ApiOperation({
    summary: 'Lista las versiones, años y potencia de un modelo',
  })
  @ApiQuery({ name: 'type', enum: VehicleType })
  @ApiQuery({ name: 'brand', example: 'Yamaha' })
  @ApiQuery({ name: 'model', example: 'FZ' })
  @ApiOkResponse({
    description: 'Versiones con rango de años y potencia aproximada',
    type: [CatalogVersionDto],
  })
  findVersions(@Query() query: CatalogVersionsQueryDto): CatalogVersionDto[] {
    return this.catalogService.findVersions(
      query.type,
      query.brand,
      query.model,
    );
  }
}

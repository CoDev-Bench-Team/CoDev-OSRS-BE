import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { PaginatedAssetsQueryDto } from './dto/paginated-assets-query.dto.js';
import {
  ApiBadRequestProblemResponse,
  ApiConflictProblemResponse,
  ApiExampleResponse,
  ApiForbiddenProblemResponse,
  ApiNotFoundProblemResponse,
  ApiUnauthorizedProblemResponse,
  ApiValidationProblemResponse,
} from '../common/api-validation-problem-response.decorator.js';
import { Roles } from '../auth/roles.decorator.js';

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'List catalog assets with live available-stock counts.',
    description:
      'Returns assets in ascending ID order with pagination metadata. Optional filters support partial matches on name, model, or category; exact category and office filters; and stock-level filtering. Quantity counts only Available inventory units, scoped to the requested office when provided. Requires an authenticated admin or employee session.',
  })
  @ApiExampleResponse(200, 'Page of catalog assets and pagination metadata.', {
    data: [
      {
        id: 1,
        category: 'Laptop',
        name: 'Business Laptop',
        model: 'Dell Latitude 5440',
        lowQtyAlert: 5,
        imageBase64: null,
        description: '14-inch business laptop',
        ram: '16GB',
        processor: 'Intel Core i7-1355U',
        graphics: 'Intel Iris Xe Graphics',
        operatingSystem: 'Windows 11 Pro',
        storage: '512GB SSD',
        createdAt: '2026-01-15T09:30:00.000Z',
        updatedAt: null,
        quantity: 8,
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  })
  @ApiValidationProblemResponse(PaginatedAssetsQueryDto)
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @Roles('admin', 'employee')
  @Get()
  list(@Query() paginatedAssetsQueryDto: PaginatedAssetsQueryDto) {
    return this.assetsService.list(paginatedAssetsQueryDto);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Get one catalog asset and its available-stock count.',
    description:
      'Looks up an asset by its numeric ID. The quantity is the number of Available inventory units across all offices. Requires an authenticated admin or employee session.',
  })
  @ApiExampleResponse(200, 'The requested catalog asset.', {
    id: 1,
    category: 'Laptop',
    name: 'Business Laptop',
    model: 'Dell Latitude 5440',
    lowQtyAlert: 5,
    imageBase64: null,
    description: '14-inch business laptop',
    ram: '16GB',
    processor: 'Intel Core i7-1355U',
    graphics: 'Intel Iris Xe Graphics',
    operatingSystem: 'Windows 11 Pro',
    storage: '512GB SSD',
    createdAt: '2026-01-15T09:30:00.000Z',
    updatedAt: null,
    quantity: 8,
  })
  @ApiBadRequestProblemResponse(
    'Validation failed (numeric string is expected)',
  )
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('Asset')
  @Roles('admin', 'employee')
  @Get(':id')
  find(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.find(id);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Create a catalog asset.',
    description:
      'Creates a catalog definition with descriptive and technical specifications. Inventory units are added separately, so a new asset starts with quantity zero. Admin session required.',
  })
  @ApiExampleResponse(
    201,
    'The created catalog asset; its initial quantity is zero.',
    {
      id: 1,
      category: 'Laptop',
      name: 'Business Laptop',
      model: 'Dell Latitude 5440',
      lowQtyAlert: 5,
      imageBase64: null,
      description: '14-inch business laptop',
      ram: '16GB',
      processor: 'Intel Core i7-1355U',
      graphics: 'Intel Iris Xe Graphics',
      operatingSystem: 'Windows 11 Pro',
      storage: '512GB SSD',
      createdAt: '2026-01-15T09:30:00.000Z',
      updatedAt: null,
      quantity: 0,
    },
  )
  @ApiValidationProblemResponse(CreateAssetDto)
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @Roles('admin')
  @Post()
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.create(createAssetDto);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Update a catalog asset.',
    description:
      'Partially updates catalog details. Send null for nullable specifications to clear them; quantity is derived from inventory and cannot be edited here. Admin session required.',
  })
  @ApiExampleResponse(
    200,
    'The updated catalog asset with its current available quantity.',
    {
      id: 1,
      category: 'Laptop',
      name: 'Business Laptop',
      model: 'Dell Latitude 5440',
      lowQtyAlert: 4,
      imageBase64: null,
      description: '14-inch business laptop',
      ram: '16GB',
      processor: 'Intel Core i7-1355U',
      graphics: 'Intel Iris Xe Graphics',
      operatingSystem: 'Windows 11 Pro',
      storage: '512GB SSD',
      createdAt: '2026-01-15T09:30:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
      quantity: 8,
    },
  )
  @ApiValidationProblemResponse(UpdateAssetDto, {
    invalidId: {
      summary: 'The route ID is not an integer.',
      detail: 'Validation failed (numeric string is expected)',
    },
  })
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('Asset')
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssetDto: UpdateAssetDto,
  ) {
    return this.assetsService.update(id, updateAssetDto);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Delete a catalog asset that has no inventory units.',
    description:
      'Removes the catalog record and returns the removed asset. Deletion is refused while any inventory units reference the asset. Admin session required.',
  })
  @ApiExampleResponse(200, 'The removed catalog asset.', {
    id: 1,
    category: 'Laptop',
    name: 'Business Laptop',
    model: 'Dell Latitude 5440',
    lowQtyAlert: 5,
    imageBase64: null,
    description: '14-inch business laptop',
    ram: null,
    processor: null,
    graphics: null,
    operatingSystem: null,
    storage: null,
    createdAt: '2026-01-15T09:30:00.000Z',
    updatedAt: null,
  })
  @ApiBadRequestProblemResponse(
    'Validation failed (numeric string is expected)',
  )
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('Asset')
  @ApiConflictProblemResponse(
    "Asset with ID '42' still has stock units and cannot be deleted.",
  )
  @Roles('admin')
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.delete(id);
  }
}

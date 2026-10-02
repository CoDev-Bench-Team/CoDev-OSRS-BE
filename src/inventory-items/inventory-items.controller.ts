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
import { InventoryItemsService } from './inventory-items.service.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { CreateInventoryItemBatchDto } from './dto/create-inventory-item-batch.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { PaginatedInventoryItemsQueryDto } from './dto/paginated-inventory-items-query.dto.js';
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

@ApiTags('Inventory Items')
@Controller('inventory-items')
export class InventoryItemsController {
  constructor(private readonly inventoryItemsService: InventoryItemsService) {}

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'List individually tracked inventory units.',
    description:
      'Returns inventory units with their linked catalog asset and pagination metadata. Supports partial asset-name/model/category search and filters by category, status, or assigned user. Requires an authenticated admin or employee session.',
  })
  @ApiExampleResponse(200, 'Page of inventory units and pagination metadata.', {
    data: [
      {
        id: 12,
        asset: {
          id: 1,
          name: 'Business Laptop',
          model: 'Dell Latitude 5440',
          category: 'Laptop',
        },
        serialNumber: 'PF3ABCXY',
        bitlockerIdentifier: null,
        recoveryPin: null,
        description: null,
        attachmentUrl: null,
        assignedAt: null,
        status: 'Available',
        location: 'Cebu',
        price: 1299.99,
        supplier: 'Amazon',
        purchasedAt: '2026-01-15T00:00:00.000Z',
        createdAt: '2026-01-16T09:30:00.000Z',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  })
  @ApiValidationProblemResponse(PaginatedInventoryItemsQueryDto)
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @Roles('admin', 'employee')
  @Get()
  list(@Query() query: PaginatedInventoryItemsQueryDto) {
    return this.inventoryItemsService.findAll(query);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Get one inventory unit by ID.',
    description:
      'Returns an individual physical unit together with its linked catalog asset. Requires an authenticated admin or employee session.',
  })
  @ApiExampleResponse(200, 'The requested inventory unit.', {
    id: 12,
    asset: {
      id: 1,
      name: 'Business Laptop',
      model: 'Dell Latitude 5440',
      category: 'Laptop',
    },
    serialNumber: 'PF3ABCXY',
    bitlockerIdentifier: null,
    recoveryPin: null,
    description: null,
    attachmentUrl: null,
    assignedAt: null,
    status: 'Available',
    location: 'Cebu',
    price: 1299.99,
    supplier: 'Amazon',
    purchasedAt: '2026-01-15T00:00:00.000Z',
    createdAt: '2026-01-16T09:30:00.000Z',
  })
  @ApiBadRequestProblemResponse(
    'Validation failed (numeric string is expected)',
  )
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('Inventory item')
  @Roles('admin', 'employee')
  @Get(':id')
  find(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryItemsService.findOne(id);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Register one physical inventory unit.',
    description:
      'Creates an individual unit for an existing asset. The unit starts Available unless assignedToId is provided, in which case it starts Assigned. Serial numbers must be unique. Admin session required.',
  })
  @ApiExampleResponse(
    201,
    'The created inventory unit with its catalog asset.',
    {
      id: 12,
      asset: {
        id: 1,
        name: 'Business Laptop',
        model: 'Dell Latitude 5440',
        category: 'Laptop',
      },
      serialNumber: 'PF3ABCXY',
      bitlockerIdentifier: null,
      recoveryPin: null,
      description: null,
      attachmentUrl: null,
      assignedAt: null,
      status: 'Available',
      location: 'Cebu',
      price: 1299.99,
      supplier: 'Amazon',
      purchasedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-16T09:30:00.000Z',
    },
  )
  @ApiValidationProblemResponse(CreateInventoryItemDto, {
    invalidAsset: {
      summary: 'The referenced catalog asset does not exist.',
      detail: "Asset with ID '42' could not be found.",
    },
    repeatedSerial: {
      summary: 'Serial numbers are repeated in the request.',
      detail: 'Serial numbers must be unique; repeated: PF3ABCXY.',
    },
  })
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiConflictProblemResponse('Serial numbers already in use: PF3ABCXY.')
  @Roles('admin')
  @Post()
  create(@Body() createInventoryItemDto: CreateInventoryItemDto) {
    return this.inventoryItemsService.create(createInventoryItemDto);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Register a batch of physical inventory units.',
    description:
      'Creates between 1 and 100 units for one existing catalog asset. Purchase details and location are shared across the batch; serial and BitLocker details are supplied per unit. All supplied serial numbers must be unique. Admin session required.',
  })
  @ApiExampleResponse(201, 'The created inventory units.', [
    {
      id: 12,
      asset: {
        id: 1,
        name: 'Business Laptop',
        model: 'Dell Latitude 5440',
        category: 'Laptop',
      },
      serialNumber: 'PF3ABCXY',
      status: 'Available',
      location: 'Cebu',
      price: 1299.99,
      supplier: 'Amazon',
      purchasedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-16T09:30:00.000Z',
    },
    {
      id: 13,
      asset: {
        id: 1,
        name: 'Business Laptop',
        model: 'Dell Latitude 5440',
        category: 'Laptop',
      },
      serialNumber: 'PF3ABCDZ',
      status: 'Available',
      location: 'Cebu',
      price: 1299.99,
      supplier: 'Amazon',
      purchasedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-16T09:30:00.000Z',
    },
  ])
  @ApiValidationProblemResponse(CreateInventoryItemBatchDto, {
    invalidAsset: {
      summary: 'The referenced catalog asset does not exist.',
      detail: "Asset with ID '42' could not be found.",
    },
    repeatedSerial: {
      summary: 'Serial numbers are repeated in the batch.',
      detail: 'Serial numbers must be unique; repeated: PF3ABCXY.',
    },
  })
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiConflictProblemResponse('Serial numbers already in use: PF3ABCXY.')
  @Roles('admin')
  @Post('bulk')
  createBulk(@Body() createInventoryItemBatchDto: CreateInventoryItemBatchDto) {
    return this.inventoryItemsService.createBulk(createInventoryItemBatchDto);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Update an inventory unit.',
    description:
      'Partially updates unit details, optionally changes its catalog asset, or assigns/unassigns a user. Setting assignedToId to null clears the assignment and makes the unit Available. Serial numbers must remain unique. Admin session required.',
  })
  @ApiExampleResponse(200, 'The updated inventory unit.', {
    id: 12,
    asset: {
      id: 1,
      name: 'Business Laptop',
      model: 'Dell Latitude 5440',
      category: 'Laptop',
    },
    serialNumber: 'PF3ABCXY',
    bitlockerIdentifier: null,
    recoveryPin: null,
    description: 'Issued for project setup',
    attachmentUrl: null,
    assignedAt: '2026-02-01T09:00:00.000Z',
    status: 'Assigned',
    location: 'Cebu',
    price: 1299.99,
    supplier: 'Amazon',
    purchasedAt: '2026-01-15T00:00:00.000Z',
    createdAt: '2026-01-16T09:30:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
  })
  @ApiValidationProblemResponse(UpdateInventoryItemDto, {
    invalidId: {
      summary: 'The route ID is not an integer.',
      detail: 'Validation failed (numeric string is expected)',
    },
    invalidAsset: {
      summary: 'The referenced catalog asset does not exist.',
      detail: 'Asset with ID 42 could not be found.',
    },
  })
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('Inventory item')
  @ApiConflictProblemResponse('Serial numbers already in use: PF3ABCXY.')
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventoryItemDto: UpdateInventoryItemDto,
  ) {
    return this.inventoryItemsService.update(id, updateInventoryItemDto);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Remove an inventory unit.',
    description:
      'Deletes one physical-unit record and returns the removed unit. Admin session required.',
  })
  @ApiExampleResponse(200, 'The removed inventory unit.', {
    id: 12,
    asset: {
      id: 1,
      name: 'Business Laptop',
      model: 'Dell Latitude 5440',
      category: 'Laptop',
    },
    serialNumber: 'PF3ABCXY',
    status: 'Available',
    location: 'Cebu',
    price: 1299.99,
    supplier: 'Amazon',
    createdAt: '2026-01-16T09:30:00.000Z',
  })
  @ApiBadRequestProblemResponse(
    'Validation failed (numeric string is expected)',
  )
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('Inventory item')
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryItemsService.remove(id);
  }
}

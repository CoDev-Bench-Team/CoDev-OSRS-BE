import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { Asset, AssetCategory } from '../assets/entities/asset.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { CreateInventoryItemBatchDto } from './dto/create-inventory-item-batch.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { RemoveInventoryItemDto } from './dto/remove-inventory-item.dto.js';
import { PaginatedInventoryItemsQueryDto } from './dto/paginated-inventory-items-query.dto.js';
import { InventoryItem, InventoryItemStatus } from './entities/inventory-item.entity.js';
import { PaginatedResult } from '../common/paginated-result.js';

// Units matching the list's filters except status, per status (every status present)
type InventoryItemStatusCounts = { total: number; byStatus: Record<InventoryItemStatus, number> };

type InventoryItemsPage = PaginatedResult<InventoryItem> & { counts: InventoryItemStatusCounts };

@Injectable()
export class InventoryItemsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
  ) {}

  async findAll({ page = 1, limit = 10, search, category, status, assignedToId }: PaginatedInventoryItemsQueryDto): Promise<InventoryItemsPage> {
    const query = this.withRelations(this.filteredUnits(search, category, assignedToId), 'summary');
    if (status) {
      query.andWhere('inventoryItem.status = :status', { status });
    }

    const [[data, total], counts] = await Promise.all([
      query
        .orderBy('inventoryItem.id', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount(),
      this.statusCounts(search, category, assignedToId),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit), counts };
  }

  //
  // Units matching the search text, category and assignee, before status filtering
  //
  private filteredUnits(search?: string, category?: AssetCategory, assignedToId?: number) {
    const query = this.inventoryItemRepository
      .createQueryBuilder('inventoryItem')
      .innerJoin('inventoryItem.asset', 'asset')
      .leftJoin('inventoryItem.assignedTo', 'assignedTo');

    if (search) {
      query.andWhere(
        `(asset.name ILIKE :search OR asset.model ILIKE :search OR CAST(asset.category AS text) ILIKE :search
          OR inventoryItem.serialNumber ILIKE :search OR inventoryItem.purchaseRequest ILIKE :search)`,
        { search: `%${search}%` },
      );
    }
    if (category) {
      query.andWhere('asset.category = :category', { category });
    }
    if (assignedToId !== undefined) {
      query.andWhere('assignedTo.id = :assignedToId', { assignedToId });
    }
    return query;
  }

  //
  // Selects the unit's asset and its assignee's public fields (no Google
  // subject, role or audit columns). Lists take an asset summary: the full
  // asset carries its image and specs, repeated on every unit of that asset
  //
  private withRelations(query: SelectQueryBuilder<InventoryItem>, asset: 'summary' | 'full') {
    return query
      .addSelect(asset === 'summary' ? ['asset.id', 'asset.name', 'asset.model', 'asset.category'] : ['asset'])
      .addSelect(['assignedTo.id', 'assignedTo.firstName', 'assignedTo.lastName', 'assignedTo.email']);
  }

  //
  // How many units match the search, category and assignee in each status,
  // ignoring the status filter so every filter chip keeps its count
  //
  private async statusCounts(search?: string, category?: AssetCategory, assignedToId?: number): Promise<InventoryItemStatusCounts> {
    const rows = await this.filteredUnits(search, category, assignedToId)
      .select('inventoryItem.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('inventoryItem.status')
      .getRawMany<{ status: InventoryItemStatus; count: string }>();

    const byStatus = Object.fromEntries(
      Object.values(InventoryItemStatus).map((value) => [value, 0]),
    ) as Record<InventoryItemStatus, number>;
    for (const { status, count } of rows) {
      byStatus[status] = Number(count);
    }

    return { total: Object.values(byStatus).reduce((sum, count) => sum + count, 0), byStatus };
  }

  async create(createInventoryItemDto: CreateInventoryItemDto): Promise<InventoryItem> {
    const { assetId, assignedToId, ...itemDetails } = createInventoryItemDto;
    const asset = await this.findAsset(assetId);

    await this.assertSerialNumbersAvailable([itemDetails.serialNumber]);

    const assignment = assignedToId === undefined
      ? { status: InventoryItemStatus.AVAILABLE }
      : { status: InventoryItemStatus.ASSIGNED, assignedTo: { id: assignedToId } as User, assignedAt: new Date() };

    const savedItem = await this.inventoryItemRepository.save(
      this.inventoryItemRepository.create({
        ...this.omitUndefined(itemDetails),
        ...assignment,
        asset,
        createdAt: new Date(),
      }),
    );

    return this.findOne(savedItem.id);
  }

  async createBulk(createInventoryItemBatchDto: CreateInventoryItemBatchDto): Promise<InventoryItem[]> {
    const { assetId, units, ...sharedDetails } = createInventoryItemBatchDto;
    const asset = await this.findAsset(assetId);

    await this.assertSerialNumbersAvailable(units.map((unit) => unit.serialNumber));

    const shared = this.omitUndefined(sharedDetails);
    return this.addInventoryItems(asset, units.map((unit) => ({ ...shared, ...this.omitUndefined(unit) })));
  }

  async findOne(id: number): Promise<InventoryItem> {
    const item = await this.withRelations(
      this.inventoryItemRepository
        .createQueryBuilder('inventoryItem')
        .innerJoin('inventoryItem.asset', 'asset')
        .leftJoin('inventoryItem.assignedTo', 'assignedTo'),
      'full',
    )
      .where('inventoryItem.id = :id', { id })
      .getOne();
    if (!item) {
      throw new NotFoundException(`Inventory item with ID '${id}' could not be found.`);
    }
    return item;
  }

  async update(id: number, updateInventoryItemDto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const itemToUpdate = await this.inventoryItemRepository.findOne({ where: { id }, relations: { assignedTo: true } });
    if (!itemToUpdate) {
      throw new NotFoundException(`Inventory item with ID '${id}' could not be found.`);
    }

    const { assetId, assignedToId, ...itemChanges } = updateInventoryItemDto;
    const asset = assetId === undefined ? undefined : await this.findAsset(assetId);
    // Re-sending the current assignee (the edit form always does) keeps the original assigned-on date
    const sameAssignee = assignedToId != null && itemToUpdate.assignedTo?.id === assignedToId;
    const assignment = assignedToId === undefined || sameAssignee
      ? {}
      : assignedToId === null
        ? { assignedTo: null, assignedAt: null, status: InventoryItemStatus.AVAILABLE }
        : { assignedTo: { id: assignedToId } as User, assignedAt: new Date(), status: InventoryItemStatus.ASSIGNED };

    await this.assertSerialNumbersAvailable([itemChanges.serialNumber], id);

    await this.inventoryItemRepository.save({
      ...itemToUpdate,
      ...assignment,
      ...this.omitUndefined(itemChanges),
      ...(asset ? { asset } : {}),
      updatedAt: new Date(),
    });

    return this.findOne(id);
  }

  //
  // Soft-deletes the unit: it drops out of every list and stock count but stays
  // in the database with deletedAt, deletedBy and the admin's removal reason
  //
  async remove(id: number, { reason }: RemoveInventoryItemDto, actor: User): Promise<InventoryItem> {
    const item = await this.inventoryItemRepository.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID '${id}' could not be found.`);
    }

    await this.inventoryItemRepository.manager.transaction(async (manager) => {
      await manager.update(InventoryItem, id, { removalReason: reason.trim(), deletedBy: actor });
      await manager.softDelete(InventoryItem, id);
    });

    return this.inventoryItemRepository.findOneOrFail({
      where: { id },
      relations: { asset: true },
      withDeleted: true,
    });
  }

  async countAvailableForAssets(assetIds: number[], location?: string): Promise<Map<number, number>> {
    if (!assetIds.length) {
      return new Map();
    }

    const query = this.inventoryItemRepository
      .createQueryBuilder('inventoryItem')
      .select('inventoryItem.assetId', 'assetId')
      .addSelect('COUNT(inventoryItem.id)', 'count')
      .where('inventoryItem.assetId IN (:...assetIds)', { assetIds })
      .andWhere('inventoryItem.status = :status', { status: InventoryItemStatus.AVAILABLE });

    if (location) {
      query.andWhere('inventoryItem.location = :location', { location });
    }

    const counts = await query
      .groupBy('inventoryItem.assetId')
      .getRawMany<{ assetId: number; count: string }>();

    return new Map(counts.map(({ assetId, count }) => [assetId, Number(count)]));
  }

  countForAsset(assetId: number): Promise<number> {
    return this.inventoryItemRepository.count({ where: { asset: { id: assetId } } });
  }

  private async findAsset(id: number): Promise<Asset> {
    const asset = await this.assetRepository.findOneBy({ id });
    if (!asset) {
      throw new BadRequestException(`Asset with ID '${id}' could not be found.`);
    }
    return asset;
  }

  private async addInventoryItems(asset: Asset, items: DeepPartial<InventoryItem>[]): Promise<InventoryItem[]> {
    if (!items.length) {
      return [];
    }

    const inventoryItems = items.map((item) => this.inventoryItemRepository.create({
      ...item,
      asset,
      status: InventoryItemStatus.AVAILABLE,
      createdAt: new Date(),
    }));

    return this.inventoryItemRepository.save(inventoryItems);
  }

  private async assertSerialNumbersAvailable(serialNumbers: (string | null | undefined)[], excludeId?: number): Promise<void> {
    const provided = serialNumbers.filter((serialNumber): serialNumber is string => typeof serialNumber === 'string');
    if (!provided.length) {
      return;
    }

    const repeated = [...new Set(provided.filter((serialNumber, index) => provided.indexOf(serialNumber) !== index))];
    if (repeated.length) {
      throw new BadRequestException(`Serial numbers must be unique; repeated: ${repeated.join(', ')}.`);
    }

    const taken = await this.inventoryItemRepository.find({
      select: { serialNumber: true },
      where: {
        serialNumber: In(provided),
        ...(excludeId === undefined ? {} : { id: Not(excludeId) }),
      },
    });
    if (taken.length) {
      throw new ConflictException(`Serial numbers already in use: ${taken.map((item) => item.serialNumber).join(', ')}.`);
    }
  }

  private omitUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
  }
}

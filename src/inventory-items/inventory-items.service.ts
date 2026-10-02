import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, Not, Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { CreateInventoryItemBatchDto } from './dto/create-inventory-item-batch.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { PaginatedInventoryItemsQueryDto } from './dto/paginated-inventory-items-query.dto.js';
import { InventoryItem, InventoryItemStatus } from './entities/inventory-item.entity.js';
import { PaginatedResult } from '../common/paginated-result.js';

@Injectable()
export class InventoryItemsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
  ) {}

  async findAll({ page = 1, limit = 10, search, category, status, assignedToId }: PaginatedInventoryItemsQueryDto): Promise<PaginatedResult<InventoryItem>> {
    const query = this.inventoryItemRepository
      .createQueryBuilder('inventoryItem')
      .innerJoinAndSelect('inventoryItem.asset', 'asset');

    if (search) {
      query.andWhere(
        '(asset.name ILIKE :search OR asset.model ILIKE :search OR CAST(asset.category AS text) ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (category) {
      query.andWhere('asset.category = :category', { category });
    }
    if (status) {
      query.andWhere('inventoryItem.status = :status', { status });
    }
    if (assignedToId !== undefined) {
      query
        .innerJoin('inventoryItem.assignedTo', 'assignedTo')
        .andWhere('assignedTo.id = :assignedToId', { assignedToId });
    }

    const [data, total] = await query
      .orderBy('inventoryItem.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
    const item = await this.inventoryItemRepository.findOne({
      where: { id },
      relations: { asset: true },
    });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID '${id}' could not be found.`);
    }
    return item;
  }

  async update(id: number, updateInventoryItemDto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const itemToUpdate = await this.inventoryItemRepository.findOneBy({ id });
    if (!itemToUpdate) {
      throw new NotFoundException(`Inventory item with ID '${id}' could not be found.`);
    }

    const { assetId, assignedToId, ...itemChanges } = updateInventoryItemDto;
    const asset = assetId === undefined ? undefined : await this.findAsset(assetId);
    const assignment = assignedToId === undefined
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

  async remove(id: number): Promise<InventoryItem> {
    const item = await this.inventoryItemRepository.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID '${id}' could not be found.`);
    }
    return this.inventoryItemRepository.remove(item);
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

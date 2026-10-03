import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Asset, AssetCategory, AssetLocation } from './entities/asset.entity.js';
import { InventoryItem, InventoryItemStatus } from '../inventory-items/entities/inventory-item.entity.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { AssetStockLevel, PaginatedAssetsQueryDto } from './dto/paginated-assets-query.dto.js';
import { PaginatedResult } from '../common/paginated-result.js';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

// quantity is the Available count; totalQuantity is Available + Reserved
type AssetWithQuantity = Asset & {
    quantity: number;
    reservedQuantity: number;
    assignedQuantity: number;
    totalQuantity: number;
};

const EMPTY_STOCK = { quantity: 0, reservedQuantity: 0, assignedQuantity: 0, totalQuantity: 0 };

// Assets matching the list's filters except stockLevel, per stock level
type AssetStockLevelCounts = { total: number; byStockLevel: Record<AssetStockLevel, number> };

type AssetsPage = PaginatedResult<AssetWithQuantity> & { counts: AssetStockLevelCounts };

@Injectable()
export class AssetsService {
    constructor(
        @InjectRepository(Asset)
        private readonly assetRepository: Repository<Asset>,
        @InjectRepository(InventoryItem)
        private readonly inventoryItemRepository: Repository<InventoryItem>,
    ) {}


    //
    // Returns paginated results given the current page and how many items per page,
    // optionally filtered by search text, category, office location, and stock level
    //
    async list({ page = 1, limit = 10, search, category, location, stockLevel }: PaginatedAssetsQueryDto): Promise<AssetsPage> {
        const query = this.filteredAssets(search, category);
        if (stockLevel) {
            query.andWhere(this.stockLevelConditions(location)[stockLevel], this.stockParameters(location));
        }

        const [[data, total], counts] = await Promise.all([
            query
                .orderBy('asset.id', 'ASC')
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            this.stockLevelCounts(search, category, location),
        ]);

        return {
            data: await this.attachQuantities(data, location),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            counts,
        };
    }

    //
    // Assets matching the search text and category, before stock-level filtering
    //
    private filteredAssets(search?: string, category?: AssetCategory) {
        const query = this.assetRepository.createQueryBuilder('asset');

        if (search) {
            query.andWhere(
                '(asset.name ILIKE :search OR asset.model ILIKE :search OR CAST(asset.category AS text) ILIKE :search)',
                { search: `%${search}%` },
            );
        }
        if (category) {
            query.andWhere('asset.category = :category', { category });
        }
        return query;
    }

    //
    // SQL conditions for each stock level, using the same count attachQuantities
    // reports as quantity: Available units, scoped to the location if given
    //
    private stockLevelConditions(location?: AssetLocation): Record<AssetStockLevel, string> {
        const availableCount = `(
            SELECT COUNT(*) FROM inventory_items inventory
            WHERE inventory."asset_id" = asset.id
              AND inventory.status = :availableStatus
              AND inventory."deleted_at" IS NULL
              ${location ? 'AND inventory.location = :location' : ''}
        )`;
        return {
            [AssetStockLevel.OUT_OF_STOCK]: `${availableCount} = 0`,
            [AssetStockLevel.LOW_STOCK]: `${availableCount} BETWEEN 1 AND asset."low_qty_alert"`,
            [AssetStockLevel.IN_STOCK]: `${availableCount} > asset."low_qty_alert"`,
        };
    }

    private stockParameters(location?: AssetLocation) {
        return { availableStatus: InventoryItemStatus.AVAILABLE, location };
    }

    //
    // How many assets match the search, category and location at each stock
    // level, ignoring the stock-level filter so every filter chip keeps its count
    //
    private async stockLevelCounts(search?: string, category?: AssetCategory, location?: AssetLocation): Promise<AssetStockLevelCounts> {
        const conditions = this.stockLevelConditions(location);
        const raw = await this.filteredAssets(search, category)
            .select('COUNT(*)', 'total')
            .addSelect(`COUNT(*) FILTER (WHERE ${conditions[AssetStockLevel.IN_STOCK]})`, AssetStockLevel.IN_STOCK)
            .addSelect(`COUNT(*) FILTER (WHERE ${conditions[AssetStockLevel.LOW_STOCK]})`, AssetStockLevel.LOW_STOCK)
            .addSelect(`COUNT(*) FILTER (WHERE ${conditions[AssetStockLevel.OUT_OF_STOCK]})`, AssetStockLevel.OUT_OF_STOCK)
            .setParameters(this.stockParameters(location))
            .getRawOne<Record<'total' | AssetStockLevel, string>>();

        return {
            total: Number(raw?.total ?? 0),
            byStockLevel: {
                [AssetStockLevel.IN_STOCK]: Number(raw?.[AssetStockLevel.IN_STOCK] ?? 0),
                [AssetStockLevel.LOW_STOCK]: Number(raw?.[AssetStockLevel.LOW_STOCK] ?? 0),
                [AssetStockLevel.OUT_OF_STOCK]: Number(raw?.[AssetStockLevel.OUT_OF_STOCK] ?? 0),
            },
        };
    }

    //
    // Returns 1 Asset given the id number of the Asset
    //
    async find(id: number): Promise<AssetWithQuantity> {
        const asset = await this.assetRepository.findOneBy({ id });
        if (!asset) {
            throw new NotFoundException(`Asset with ID '${id}' could not be found.`);
        }

        const [assetWithQuantity] = await this.attachQuantities([asset]);
        return assetWithQuantity;
    }


    //
    // Inserts the passed asset entry to DB. Stock units are added separately,
    // so a newly created asset always starts with a quantity of 0
    //
    async create(createAsset: CreateAssetDto): Promise<AssetWithQuantity> {
        const newAsset = this.assetRepository.create({
            ...createAsset,
            createdAt: new Date(),
        });

        const savedAsset = await this.assetRepository.save(newAsset);

        return Object.assign(savedAsset, EMPTY_STOCK);
    }

    //
    // Updates the passed asset entry to DB
    //
    async update(id: number, updateAssetDto: UpdateAssetDto): Promise<AssetWithQuantity> {
        const assetToUpdate = await this.assetRepository.findOneBy({ id });
        if (!assetToUpdate) {
            throw new NotFoundException(`Asset with ID '${id}' could not be found.`);
        }

        const savedAsset = await this.assetRepository.save({
            ...assetToUpdate,
            ...this.omitUndefined(updateAssetDto),
            updatedAt: new Date(),
        });

        const [assetWithQuantity] = await this.attachQuantities([savedAsset]);
        return assetWithQuantity;
    }

    // Strips undefined-valued keys from a DTO before merging it into an entity.
    // Declared-but-unset fields on a validated DTO instance surface as explicit
    // `undefined` own properties (a class-transformer + TS class-field quirk), which
    // would otherwise overwrite good existing values when spread into the entity.
    //
    private omitUndefined<T extends object>(obj: T): Partial<T> {
        return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
    }

    //
    // Counts each asset's InventoryItem records by status (at the given location,
    // if any) and attaches them: quantity (Available), reservedQuantity,
    // assignedQuantity, and totalQuantity (Available + Reserved)
    //
    private async attachQuantities(assets: Asset[], location?: AssetLocation): Promise<AssetWithQuantity[]> {
        if (!assets.length) {
            return [];
        }

        const countQuery = this.inventoryItemRepository
            .createQueryBuilder('inventory')
            .innerJoin('inventory.asset', 'asset')
            .select('asset.id', 'assetId')
            .addSelect('inventory.status', 'status')
            .addSelect('COUNT(inventory.id)', 'count')
            .where('asset.id IN (:...assetIds)', { assetIds: assets.map((asset) => asset.id) })
            .andWhere('inventory.status IN (:...statuses)', {
                statuses: [InventoryItemStatus.AVAILABLE, InventoryItemStatus.RESERVED, InventoryItemStatus.ASSIGNED],
            });

        if (location) {
            countQuery.andWhere('inventory.location = :location', { location });
        }

        const counts = await countQuery
            .groupBy('asset.id')
            .addGroupBy('inventory.status')
            .getRawMany<{ assetId: number; status: InventoryItemStatus; count: string }>();

        const countsByAssetId = new Map<number, Partial<Record<InventoryItemStatus, number>>>();
        for (const { assetId, status, count } of counts) {
            countsByAssetId.set(assetId, { ...countsByAssetId.get(assetId), [status]: Number(count) });
        }

        return assets.map((asset) => {
            const statusCounts = countsByAssetId.get(asset.id) ?? {};
            const available = statusCounts[InventoryItemStatus.AVAILABLE] ?? 0;
            const reserved = statusCounts[InventoryItemStatus.RESERVED] ?? 0;
            return Object.assign(asset, {
                quantity: available,
                reservedQuantity: reserved,
                assignedQuantity: statusCounts[InventoryItemStatus.ASSIGNED] ?? 0,
                totalQuantity: available + reserved,
            });
        });
    }

    //
    // Removes the Asset Record from the DB with the given id
    //
    async delete(id: number): Promise<Asset> {
        const assetToDelete = await this.assetRepository.findOneBy({ id });
        if (!assetToDelete) {
            throw new NotFoundException(`Asset with ID '${id}' could not be found.`);
        }

        // Removed units are soft-deleted but still reference the asset, so they block deletion too
        const stockCount = await this.inventoryItemRepository.count({ where: { asset: { id } }, withDeleted: true });
        if (stockCount > 0) {
            throw new ConflictException(`Asset with ID '${id}' has inventory units, including removed ones, and cannot be deleted.`);
        }

        return this.assetRepository.remove(assetToDelete);
    }
}

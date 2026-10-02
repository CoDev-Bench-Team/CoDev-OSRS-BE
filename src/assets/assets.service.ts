import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Asset, AssetLocation } from './entities/asset.entity.js';
import { InventoryItem, InventoryItemStatus } from '../inventory-items/entities/inventory-item.entity.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { AssetStockLevel, PaginatedAssetsQueryDto } from './dto/paginated-assets-query.dto.js';
import { PaginatedResult } from '../common/paginated-result.js';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

type AssetWithQuantity = Asset & { quantity: number };

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
    async list({ page = 1, limit = 10, search, category, location, stockLevel }: PaginatedAssetsQueryDto): Promise<PaginatedResult<AssetWithQuantity>> {
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
        if (stockLevel) {
            // Same count attachQuantities reports: Available units, scoped to the location if given
            const availableCount = `(
                                SELECT COUNT(*) FROM inventory_items inventory
                                WHERE inventory."asset_id" = asset.id
                  AND inventory.status = :availableStatus
                                    AND inventory."deleted_at" IS NULL
                  ${location ? 'AND inventory.location = :location' : ''}
            )`;
            const stockLevelConditions: Record<AssetStockLevel, string> = {
                [AssetStockLevel.OUT_OF_STOCK]: `${availableCount} = 0`,
                [AssetStockLevel.LOW_STOCK]: `${availableCount} BETWEEN 1 AND asset.lowQtyAlert`,
                [AssetStockLevel.IN_STOCK]: `${availableCount} > asset.lowQtyAlert`,
            };
            query.andWhere(stockLevelConditions[stockLevel], { availableStatus: InventoryItemStatus.AVAILABLE, location });
        }

        const [data, total] = await query
            .orderBy('asset.id', 'ASC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return {
            data: await this.attachQuantities(data, location),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
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

        return Object.assign(savedAsset, { quantity: 0 });
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
    // Computes each asset's quantity as the number of its InventoryItem
    // records that are currently Available (at the given location, if any),
    // and attaches it to the entity
    //
    private async attachQuantities(assets: Asset[], location?: AssetLocation): Promise<AssetWithQuantity[]> {
        if (!assets.length) {
            return [];
        }

        const countQuery = this.inventoryItemRepository
            .createQueryBuilder('inventory')
            .innerJoin('inventory.asset', 'asset')
            .select('asset.id', 'assetId')
            .addSelect('COUNT(inventory.id)', 'count')
            .where('asset.id IN (:...assetIds)', { assetIds: assets.map((asset) => asset.id) })
            .andWhere('inventory.status = :status', { status: InventoryItemStatus.AVAILABLE });

        if (location) {
            countQuery.andWhere('inventory.location = :location', { location });
        }

        const counts = await countQuery
            .groupBy('asset.id')
            .getRawMany<{ assetId: number; count: string }>();

        const quantityByAssetId = new Map(counts.map(({ assetId, count }) => [assetId, Number(count)]));

        return assets.map((asset) => Object.assign(asset, { quantity: quantityByAssetId.get(asset.id) ?? 0 }));
    }

    //
    // Removes the Asset Record from the DB with the given id
    //
    async delete(id: number): Promise<Asset> {
        const assetToDelete = await this.assetRepository.findOneBy({ id });
        if (!assetToDelete) {
            throw new NotFoundException(`Asset with ID '${id}' could not be found.`);
        }

        const stockCount = await this.inventoryItemRepository.count({ where: { asset: { id } } });
        if (stockCount > 0) {
            throw new ConflictException(`Asset with ID '${id}' still has stock units and cannot be deleted.`);
        }

        return this.assetRepository.remove(assetToDelete);
    }
}

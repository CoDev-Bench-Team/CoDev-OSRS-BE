import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { InventoryItem, InventoryItemStatus } from '../inventory-items/entities/inventory-item.entity.js';
import { Asset } from './entities/asset.entity.js';
import { AssetsService } from './assets.service.js';

describe('AssetsService', () => {
  let service: AssetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: getRepositoryToken(Asset), useValue: {} },
        { provide: getRepositoryToken(InventoryItem), useValue: {} },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('AssetsService stock counts and deletion', () => {
  const asset = { id: 3, name: 'ThinkPad T14', lowQtyAlert: 5 } as Asset;
  let service: AssetsService;
  let assetRepository: { findOneBy: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  let inventoryItemRepository: { createQueryBuilder: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };

  const countRows = (rows: { assetId: number; status: InventoryItemStatus; count: string }[]) => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy']) {
      builder[method] = vi.fn(() => builder);
    }
    builder.getRawMany = vi.fn().mockResolvedValue(rows);
    inventoryItemRepository.createQueryBuilder.mockReturnValue(builder);
  };

  beforeEach(async () => {
    assetRepository = { findOneBy: vi.fn().mockResolvedValue({ ...asset }), remove: vi.fn((value) => value) };
    inventoryItemRepository = { createQueryBuilder: vi.fn(), count: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: getRepositoryToken(Asset), useValue: assetRepository },
        { provide: getRepositoryToken(InventoryItem), useValue: inventoryItemRepository },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });

  it('reports available, reserved, assigned and total counts per asset', async () => {
    countRows([
      { assetId: 3, status: InventoryItemStatus.AVAILABLE, count: '18' },
      { assetId: 3, status: InventoryItemStatus.RESERVED, count: '14' },
      { assetId: 3, status: InventoryItemStatus.ASSIGNED, count: '6' },
    ]);

    await expect(service.find(3)).resolves.toMatchObject({
      quantity: 18,
      reservedQuantity: 14,
      assignedQuantity: 6,
      totalQuantity: 32,
    });
  });

  it('reports zero counts for an asset with no units', async () => {
    countRows([]);

    await expect(service.find(3)).resolves.toMatchObject({
      quantity: 0,
      reservedQuantity: 0,
      assignedQuantity: 0,
      totalQuantity: 0,
    });
  });

  it('refuses to delete an asset whose only units were removed', async () => {
    inventoryItemRepository.count.mockResolvedValue(1);

    await expect(service.delete(3)).rejects.toBeInstanceOf(ConflictException);
    expect(inventoryItemRepository.count).toHaveBeenCalledWith({ where: { asset: { id: 3 } }, withDeleted: true });
    expect(assetRepository.remove).not.toHaveBeenCalled();
  });
});

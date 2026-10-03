import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { Asset } from '../assets/entities/asset.entity.js';
import { User } from '../users/entities/user.entity.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { InventoryItem } from './entities/inventory-item.entity.js';

describe('InventoryItemsService', () => {
  let service: InventoryItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryItemsService,
        { provide: getRepositoryToken(Asset), useValue: {} },
        { provide: getRepositoryToken(InventoryItem), useValue: {} },
      ],
    }).compile();

    service = module.get<InventoryItemsService>(InventoryItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('InventoryItemsService.remove', () => {
  const admin = { id: 1, email: 'admin@codev.com' } as User;
  let service: InventoryItemsService;
  let manager: { update: ReturnType<typeof vi.fn>; softDelete: ReturnType<typeof vi.fn> };
  let inventoryItemRepository: {
    findOneBy: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    manager: { transaction: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    manager = { update: vi.fn(), softDelete: vi.fn() };
    inventoryItemRepository = {
      findOneBy: vi.fn().mockResolvedValue({ id: 12 }),
      findOneOrFail: vi.fn().mockResolvedValue({ id: 12, removalReason: 'Screen damaged beyond repair.' }),
      remove: vi.fn(),
      manager: { transaction: vi.fn((work) => work(manager)) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryItemsService,
        { provide: getRepositoryToken(Asset), useValue: {} },
        { provide: getRepositoryToken(InventoryItem), useValue: inventoryItemRepository },
      ],
    }).compile();

    service = module.get<InventoryItemsService>(InventoryItemsService);
  });

  it('soft-deletes the unit with the trimmed reason and the removing admin', async () => {
    const removed = await service.remove(12, { reason: '  Screen damaged beyond repair.  ' }, admin);

    expect(manager.update).toHaveBeenCalledWith(InventoryItem, 12, {
      removalReason: 'Screen damaged beyond repair.',
      deletedBy: admin,
    });
    expect(manager.softDelete).toHaveBeenCalledWith(InventoryItem, 12);
    expect(inventoryItemRepository.remove).not.toHaveBeenCalled();
    expect(inventoryItemRepository.findOneOrFail).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
    expect(removed).toMatchObject({ id: 12, removalReason: 'Screen damaged beyond repair.' });
  });

  it('throws NotFound for a unit that does not exist', async () => {
    inventoryItemRepository.findOneBy.mockResolvedValue(null);

    await expect(service.remove(99, { reason: 'Lost' }, admin)).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.softDelete).not.toHaveBeenCalled();
  });
});

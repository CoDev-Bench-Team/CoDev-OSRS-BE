import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Asset } from '../assets/entities/asset.entity.js';
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

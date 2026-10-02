import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryItem } from '../inventory-items/entities/inventory-item.entity.js';
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

import { Test, TestingModule } from '@nestjs/testing';
import { InventoryItemsController } from './inventory-items.controller.js';
import { InventoryItemsService } from './inventory-items.service.js';

describe('InventoryItemsController', () => {
  let controller: InventoryItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryItemsController],
      providers: [{ provide: InventoryItemsService, useValue: {} }],
    }).compile();

    controller = module.get<InventoryItemsController>(InventoryItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

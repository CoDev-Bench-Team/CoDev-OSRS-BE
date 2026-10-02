import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../assets/entities/asset.entity.js';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { InventoryItemsController } from './inventory-items.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, InventoryItem])],
  controllers: [InventoryItemsController],
  providers: [InventoryItemsService],
  exports: [InventoryItemsService],
})
export class InventoryItemsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './entities/asset.entity.js';
import { InventoryItem } from '../inventory-items/entities/inventory-item.entity.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, InventoryItem])],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}

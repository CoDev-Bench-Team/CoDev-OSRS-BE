import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from './entities/request.entity.js';
import { RequestsService } from './requests.service.js';
import { RequestsController } from './requests.controller.js';
import { MailerModule } from '../mailer/mailer.module.js';
import { InventoryItem } from '../inventory-items/entities/inventory-item.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Request, InventoryItem]), MailerModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}

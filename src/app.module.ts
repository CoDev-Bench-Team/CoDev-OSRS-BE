import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObserveModule } from '@nestjs/observe';
import { dbConfig } from './config/typeorm.config.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { RequestsModule } from './requests/requests.module.js';
import { InventoryItemsModule } from './inventory-items/inventory-items.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'codev-osrs-backend',
    }),
    TypeOrmModule.forRoot({
      ...dbConfig,
      autoLoadEntities: false,
    }),
    UsersModule,
    AuthModule,
    AssetsModule,
    RequestsModule,
    InventoryItemsModule,
  ],
})
export class AppModule {}

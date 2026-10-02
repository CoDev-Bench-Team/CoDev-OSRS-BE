import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { SnakeCaseNamingStrategy } from './snake-case-naming.strategy.js';

// static import so Vercel's file tracer bundles pg (TypeORM loads it dynamically otherwise)
import 'pg';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dbConfig = {
  type: 'postgres' as const,
  host: process.env.POSTGRESQL_HOST ?? 'localhost',
  port: Number(process.env.POSTGRESQL_PORT ?? 5432),
  username: process.env.POSTGRESQL_USER ?? 'postgres',
  password: process.env.POSTGRESQL_PASSWORD ?? 'admin',
  database: process.env.POSTGRESQL_DATABASE ?? 'codev_osrs_db',
  entities: [path.join(__dirname, '..', '**/*.entity{.ts,.js}')],
  namingStrategy: new SnakeCaseNamingStrategy(),
  synchronize: false,
  migrations: [path.join(__dirname, '..', 'migrations/*{.ts,.js}')],
  migrationsRun: false,
};

export const AppDataSource = new DataSource(dbConfig);

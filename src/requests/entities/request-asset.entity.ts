import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { Asset } from '../../assets/entities/asset.entity.js';
import { Request } from './request.entity.js';

/** One line item on a `Request`, joined to `Asset` (and, transitively,
 * `InventoryItem`) rather than snapshotting the asset's name — per PR #79
 * review. */
@Entity({ name: 'request_assets' })
export class RequestAsset {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Request, (request) => request.items, {
    onDelete: 'CASCADE',
  })
  request: Relation<Request>;

  @ManyToOne(() => Asset)
  asset: Relation<Asset>;

  @Column({ type: 'int' })
  quantity: number;
}

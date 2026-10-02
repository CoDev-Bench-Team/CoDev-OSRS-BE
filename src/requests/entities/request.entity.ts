import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Index,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { RequestAsset } from './request-asset.entity.js';
import { AssetLocation } from '../../assets/entities/asset.entity.js';

export enum RequestStatus {
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  READY_FOR_PICKUP = 'ready_for_pickup',
  FOR_DELIVERY = 'for_delivery',
  RECEIVED = 'received',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/** One entry in `Request.timeline`, recording each status transition. */
export interface TimelineEvent {
  status: RequestStatus;
  at: string;
  byUserId?: number;
  note?: string;
}

@Entity({ name: 'requests' })
export class Request {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, unique: true })
  displayId: string;

  @ManyToOne(() => User)
  requestor: Relation<User>;

  @OneToMany(() => RequestAsset, (item) => item.request, { cascade: true })
  items: Relation<RequestAsset>[];

  @Index()
  @Column({
    length: 20,
    default: RequestStatus.PENDING_APPROVAL,
  })
  status: RequestStatus;

  /**
   * The office the request draws stock from: the requester's home office at
   * submit time (FR-006), kept even if they later move offices.
   */
  @Column({ type: 'enum', enum: AssetLocation })
  requestingOffice: AssetLocation;

  @Column({ type: 'varchar', length: 500, nullable: true })
  purpose: string | null;

  /** Required when the request is rejected; shown back to the requester. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  /** The admin who approved or rejected the request. */
  @ManyToOne(() => User, { nullable: true })
  reviewedBy: Relation<User | null>;

  /** When the request reached Completed, Rejected or Cancelled — the date
   * the History page shows and sorts by (FR-016a). */
  @Index()
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  /** Where the requester collects the items (e.g. "6th floor IT desk").
   * Set when the request is marked ready for pickup (FR-011a). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  pickupLocation: string | null;

  /** When the request was marked Received — by an admin or the requester —
   * and its units assigned (BEN-143). */
  @Column({ type: 'timestamp', nullable: true })
  receivedAt: Date | null;

  /** The full name the requester typed to sign the Accountability Form,
   * which completed the request (BEN-143). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  receivedSignature: string | null;

  /** The optional "Other Notes" from the Accountability Form. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  receivedNotes: string | null;

  /** Required when the request is cancelled; shown back to the requester. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  cancellationReason: string | null;

  /** Who cancelled the request: the requester (while pending) or an admin. */
  @ManyToOne(() => User, { nullable: true })
  cancelledBy: Relation<User | null>;

  @Column({ type: 'jsonb', default: [] })
  timeline: TimelineEvent[];

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { nullable: true })
  createdBy: Relation<User | null>;

  @UpdateDateColumn({ nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  updatedBy: Relation<User | null>;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  deletedBy: Relation<User | null>;
}

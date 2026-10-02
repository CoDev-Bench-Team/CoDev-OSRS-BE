import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	ManyToOne,
	Index,
	CreateDateColumn,
	DeleteDateColumn,
	UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Asset, AssetLocation } from '../../assets/entities/asset.entity.js';
import { Request } from '../../requests/entities/request.entity.js';

export enum InventoryItemStatus {
	AVAILABLE = 'Available',
	RESERVED = 'Reserved',
	ASSIGNED = 'Assigned',
	INACTIVE = 'Inactive',
}

@Entity({ name: 'inventory_items' })
@Index(['asset', 'status'])
@Index('UQ_inventory_items_serial_number', ['serialNumber'], { unique: true, where: '"deleted_at" IS NULL' })
export class InventoryItem {
	@PrimaryGeneratedColumn()
	id: number;

	@Index()
	@ManyToOne(() => User, { nullable: true })
	assignedTo: Relation<User | null>;

	@ManyToOne(() => Asset)
	asset: Relation<Asset>;

	/**
	 * The request that reserved this unit on submit. Lets approve/reject move
	 * exactly the units that request claimed, not just any reserved unit of
	 * the same asset. Cleared when a rejection returns the unit to stock.
	 */
	@Index()
	@ManyToOne(() => Request, { nullable: true, onDelete: 'SET NULL' })
	request: Relation<Request | null>;

	@Column({ type: 'varchar', length: 255, nullable: true })
	serialNumber: string | null;

	@Column({
		type: 'varchar',
		length: 255,
		nullable: true,
		name: 'bitlocker_identifier',
	})
	bitlockerIdentifier: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	recoveryPin: string | null;

	@Column({ type: 'text', nullable: true })
	description: string | null;

	@Column({ type: 'varchar', length: 2048, nullable: true })
	attachmentUrl: string | null;

	@Column({ type: 'timestamp', nullable: true })
	assignedAt: Date | null;

	@Column({ type: 'enum', enum: InventoryItemStatus })
	status: InventoryItemStatus;

	@Index()
	@Column({ type: 'enum', enum: AssetLocation, default: AssetLocation.CEBU })
	location: AssetLocation;

	@Column({
		type: 'decimal',
		precision: 10,
		scale: 2,
		nullable: true,
		transformer: {
			to: (value?: number | null) => value,
			from: (value: string | null) => (value === null ? null : Number(value)),
		},
	})
	price: number | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	supplier: string | null;

	@Column({ type: 'timestamp', nullable: true })
	purchasedAt: Date | null;

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

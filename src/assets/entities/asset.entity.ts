import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    Index,
    CreateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    UpdateDateColumn,
} from "typeorm";
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum AssetCategory {
    LAPTOP = 'Laptop',
    HEADSET = 'Headset',
    MONITOR = 'Monitor',
    PHONE = 'Phone',
    UPS = 'UPS',
    MICE = 'Mice',
    WIFI = 'Wifi',
    TYPECHUB = 'Type C Hub',
    OTHER = 'Other Devices'
}

export enum AssetLocation {
    CEBU = 'Cebu',
    BACOLOD = 'Bacolod',
    MAKATI = 'Makati',
    ORTIGAS = 'Ortigas',
    DAVAO = 'Davao',
}

@Entity({ name: 'assets' })
export class Asset {
    @PrimaryGeneratedColumn()
    id: number;

    @Index('IDX_assets_category')
    @Column({ type: 'enum', enum: AssetCategory, default: AssetCategory.OTHER })
    category: AssetCategory;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255 })
    model: string;

    @Column()
    lowQtyAlert: number;

    @Column({ type: 'text', nullable: true })
    imageBase64: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    ram: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    processor: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    graphics: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    operatingSystem: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    storage: string | null;

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

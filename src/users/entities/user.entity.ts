import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
}

export enum UserLocation {
  CEBU = 'Cebu',
  BACOLOD = 'Bacolod',
  MAKATI = 'Makati',
  ORTIGAS = 'Ortigas',
  DAVAO = 'Davao',
}

@Entity({ name: 'users' })
export class User {
  @ApiProperty({ description: 'The unique user identifier.', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: "The user's Google subject identifier." })
  @Column({ length: 255, unique: true })
  googleSubject: string;

  @ApiProperty({
    description: "The user's email address.",
    example: 'ada@example.com',
  })
  @Column({ length: 320, unique: true })
  email: string;

  @ApiProperty({ description: "The user's first name.", example: 'Ada' })
  @Column({ length: 50 })
  firstName: string;

  @ApiProperty({ description: "The user's last name.", example: 'Lovelace' })
  @Column({ length: 50 })
  lastName: string;

  @ApiProperty({ description: "The user's Google profile image URL." })
  @Column({ length: 2048 })
  avatarUrl: string;

  @ApiProperty({
    description: "The user's role.",
    enum: UserRole,
    example: UserRole.EMPLOYEE,
  })
  @Index()
  @Column({ length: 10, default: UserRole.EMPLOYEE })
  role: UserRole;

  @ApiProperty({
    description: "The user's closest office location.",
    enum: UserLocation,
    example: UserLocation.CEBU,
  })
  @Index()
  @Column({ length: 10, default: UserLocation.CEBU })
  location: UserLocation;

  @ApiProperty({ description: 'The date and time the user was created.' })
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  createdBy: Relation<User | null>;

  @ApiPropertyOptional({
    description: 'The date and time the user was last updated.',
    nullable: true,
  })
  @UpdateDateColumn({ nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  updatedBy: Relation<User | null>;

  @ApiPropertyOptional({
    description: 'The date and time the user was deleted.',
    nullable: true,
  })
  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  deletedBy: Relation<User | null>;
}

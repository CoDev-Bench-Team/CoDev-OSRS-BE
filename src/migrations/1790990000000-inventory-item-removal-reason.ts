import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryItemRemovalReason1790990000000 implements MigrationInterface {
  name = 'InventoryItemRemovalReason1790990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD "removal_reason" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN "removal_reason"`,
    );
  }
}

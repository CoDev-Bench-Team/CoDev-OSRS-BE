import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryItemPurchaseRequest1791250000000 implements MigrationInterface {
  name = 'InventoryItemPurchaseRequest1791250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD "purchase_request" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN "purchase_request"`,
    );
  }
}

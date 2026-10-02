import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewedByAndUnitReservations1790298049757 implements MigrationInterface {
  name = 'ReviewedByAndUnitReservations1790298049757';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" DROP CONSTRAINT "FK_f350eb49ac489490d6085bdd2e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" RENAME COLUMN "approved_by_id" TO "reviewed_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD "request_id" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_873ead9a98736a9deeb2165998" ON "inventory_items"  ("request_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD CONSTRAINT "FK_8bb44b7092e1919327f255ac2a4" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_873ead9a98736a9deeb2165998b" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // Backfill: units reserved before this column existed have no request.
    // Hand each still-pending request line as many of its asset's unlinked
    // reserved units as it asked for (oldest request first, lowest unit id
    // first), so approving/rejecting those requests still moves stock.
    await queryRunner.query(`
      WITH lines AS (
        SELECT ra.request_id, ra.asset_id, ra.quantity,
               SUM(ra.quantity) OVER (PARTITION BY ra.asset_id ORDER BY r.id) AS upto
        FROM request_assets ra
        JOIN requests r ON r.id = ra.request_id
        WHERE r.status = 'pending_approval' AND r.deleted_at IS NULL
      ),
      units AS (
        SELECT id, asset_id,
               ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY id) AS n
        FROM inventory_items
        WHERE status = 'Reserved' AND request_id IS NULL
      )
      UPDATE inventory_items i
      SET request_id = l.request_id
      FROM units u
      JOIN lines l
        ON l.asset_id = u.asset_id AND u.n > l.upto - l.quantity AND u.n <= l.upto
      WHERE i.id = u.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_873ead9a98736a9deeb2165998b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" DROP CONSTRAINT "FK_8bb44b7092e1919327f255ac2a4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_873ead9a98736a9deeb2165998"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN "request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" RENAME COLUMN "reviewed_by_id" TO "approved_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD CONSTRAINT "FK_f350eb49ac489490d6085bdd2e1" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}

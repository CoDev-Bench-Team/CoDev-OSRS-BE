import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequestResolvedAt1790378548266 implements MigrationInterface {
  name = 'RequestResolvedAt1790378548266';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "resolved_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a94814a82a71cb97f9af6e2401" ON "requests"  ("resolved_at") `,
    );

    // Backfill already-resolved requests from the timeline entry that
    // resolved them (its ISO time, converted to the column's local time),
    // falling back to the last update for any request without one.
    await queryRunner.query(`
      UPDATE "requests" r
      SET "resolved_at" = COALESCE(
        (
          SELECT MAX((e ->> 'at')::timestamptz)::timestamp
          FROM jsonb_array_elements(r."timeline") e
          WHERE e ->> 'status' = r."status"
        ),
        r."updated_at"
      )
      WHERE r."status" IN ('completed', 'rejected', 'cancelled')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a94814a82a71cb97f9af6e2401"`,
    );
    await queryRunner.query(`ALTER TABLE "requests" DROP COLUMN "resolved_at"`);
  }
}

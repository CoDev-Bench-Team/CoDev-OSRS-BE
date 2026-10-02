import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequestRequestingOffice1790377370084 implements MigrationInterface {
  name = 'RequestRequestingOffice1790377370084';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."requests_requesting_office_enum" AS ENUM('Cebu', 'Bacolod', 'Makati', 'Ortigas', 'Davao')`,
    );
    // Added nullable, backfilled from each requester's current office (the
    // best record there is of where existing requests drew stock from; an
    // unknown office falls back to Cebu, the users table's default), then
    // made NOT NULL — adding it NOT NULL outright fails on a populated table.
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "requesting_office" "public"."requests_requesting_office_enum"`,
    );
    await queryRunner.query(`
      UPDATE "requests" r
      SET "requesting_office" = CASE
        WHEN u."location" IN ('Cebu', 'Bacolod', 'Makati', 'Ortigas', 'Davao')
          THEN u."location"::"public"."requests_requesting_office_enum"
        ELSE 'Cebu'
      END
      FROM "users" u
      WHERE u."id" = r."requestor_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "requests" ALTER COLUMN "requesting_office" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" DROP COLUMN "requesting_office"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."requests_requesting_office_enum"`,
    );
  }
}

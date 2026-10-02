import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequestPickupLocation1790378144022 implements MigrationInterface {
  name = 'RequestPickupLocation1790378144022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "pickup_location" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" DROP COLUMN "pickup_location"`,
    );
  }
}

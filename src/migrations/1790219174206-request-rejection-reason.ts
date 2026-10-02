import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequestRejectionReason1790219174206 implements MigrationInterface {
  name = 'RequestRejectionReason1790219174206';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "rejection_reason" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" DROP COLUMN "rejection_reason"`,
    );
  }
}

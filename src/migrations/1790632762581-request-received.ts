import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequestReceived1790632762581 implements MigrationInterface {
  name = 'RequestReceived1790632762581';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "received_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "received_signature" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "received_notes" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" DROP COLUMN "received_notes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" DROP COLUMN "received_signature"`,
    );
    await queryRunner.query(`ALTER TABLE "requests" DROP COLUMN "received_at"`);
  }
}

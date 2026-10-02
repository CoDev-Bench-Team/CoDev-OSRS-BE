import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequestCancellation1790377674788 implements MigrationInterface {
  name = 'RequestCancellation1790377674788';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "cancellation_reason" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD "cancelled_by_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD CONSTRAINT "FK_bbe2919d5b09547800a59a2afe7" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" DROP CONSTRAINT "FK_bbe2919d5b09547800a59a2afe7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" DROP COLUMN "cancelled_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" DROP COLUMN "cancellation_reason"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1790208372080 implements MigrationInterface {
    name = 'Migrations1790208372080'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "google_subject" character varying(255) NOT NULL, "email" character varying(320) NOT NULL, "first_name" character varying(50) NOT NULL, "last_name" character varying(50) NOT NULL, "avatar_url" character varying(2048) NOT NULL, "role" character varying(10) NOT NULL DEFAULT 'employee', "location" character varying(10) NOT NULL DEFAULT 'Cebu', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP DEFAULT now(), "deleted_at" TIMESTAMP, "created_by_id" integer, "updated_by_id" integer, "deleted_by_id" integer, CONSTRAINT "UQ_402623b2ebefef1905c4d0e0d1f" UNIQUE ("google_subject"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ace513fa30d485cfd25c11a9e4" ON "users"  ("role") `);
        await queryRunner.query(`CREATE INDEX "IDX_15b3fe608b52f34df363512e39" ON "users"  ("location") `);
        await queryRunner.query(`CREATE TYPE "public"."assets_category_enum" AS ENUM('Laptop', 'Headset', 'Monitor', 'Phone', 'UPS', 'Mice', 'Wifi', 'Type C Hub', 'Other Devices')`);
        await queryRunner.query(`CREATE TABLE "assets" ("id" SERIAL NOT NULL, "category" "public"."assets_category_enum" NOT NULL DEFAULT 'Other Devices', "name" character varying(255) NOT NULL, "model" character varying(255) NOT NULL, "low_qty_alert" integer NOT NULL, "image_base64" text, "description" text, "ram" character varying(255), "processor" character varying(255), "graphics" character varying(255), "operating_system" character varying(255), "storage" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP DEFAULT now(), "deleted_at" TIMESTAMP, "created_by_id" integer, "updated_by_id" integer, "deleted_by_id" integer, CONSTRAINT "PK_da96729a8b113377cfb6a62439c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_assets_category" ON "assets"  ("category") `);
        await queryRunner.query(`CREATE TYPE "public"."inventory_items_status_enum" AS ENUM('Available', 'Reserved', 'Assigned', 'Inactive')`);
        await queryRunner.query(`CREATE TYPE "public"."inventory_items_location_enum" AS ENUM('Cebu', 'Bacolod', 'Makati', 'Ortigas', 'Davao')`);
        await queryRunner.query(`CREATE TABLE "inventory_items" ("id" SERIAL NOT NULL, "serial_number" character varying(255), "bitlocker_identifier" character varying(255), "recovery_pin" character varying(255), "description" text, "attachment_url" character varying(2048), "assigned_at" TIMESTAMP, "status" "public"."inventory_items_status_enum" NOT NULL, "location" "public"."inventory_items_location_enum" NOT NULL DEFAULT 'Cebu', "price" numeric(10,2), "supplier" character varying(255), "purchased_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP DEFAULT now(), "deleted_at" TIMESTAMP, "assigned_to_id" integer, "asset_id" integer, "created_by_id" integer, "updated_by_id" integer, "deleted_by_id" integer, CONSTRAINT "PK_cf2f451407242e132547ac19169" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_787d70e1c1afe9025a5eb0592c" ON "inventory_items"  ("assigned_to_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7dd3183ac78e8b50436629026" ON "inventory_items"  ("location") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_inventory_items_serial_number" ON "inventory_items"  ("serial_number") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_fb7811df2b609f718f0000cf45" ON "inventory_items"  ("asset_id", "status") `);
        await queryRunner.query(`CREATE TABLE "requests" ("id" SERIAL NOT NULL, "display_id" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending_approval', "purpose" character varying(500), "timeline" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP DEFAULT now(), "deleted_at" TIMESTAMP, "requestor_id" integer, "approved_by_id" integer, "created_by_id" integer, "updated_by_id" integer, "deleted_by_id" integer, CONSTRAINT "UQ_9fbfbbb8e0d5634f0b615e5efc8" UNIQUE ("display_id"), CONSTRAINT "PK_0428f484e96f9e6a55955f29b5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_59b85be6a3c16cbf27f8bdda1d" ON "requests"  ("status") `);
        await queryRunner.query(`CREATE TABLE "request_assets" ("id" SERIAL NOT NULL, "quantity" integer NOT NULL, "request_id" integer, "asset_id" integer, CONSTRAINT "PK_91798a7bff1188693bbf6c83abe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_1bbd34899b8e74ef2a7f3212806" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_80e310e761f458f272c20ea6add" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_4241f21b9bb35e82a6217af1aad" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_ab08d6c2ace44e63a55da44b9a7" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_4d0eb99271d89c2ad45f1f8dc21" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_b2c0d21afd92aa80e830800cec8" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_787d70e1c1afe9025a5eb0592c9" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_20f5f36371be383c2a3d053904b" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_e5a4d27d88d817600ce3d11ac7a" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_547666e1a8794dd88492234682c" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_56d00dc614fa435a3d82eabcca7" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_2ba089a75d8f797d36a14fc626e" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_f350eb49ac489490d6085bdd2e1" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_0bfd03d4c7a6067e1f88bb87c95" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_10ee4c4ea6cbd83e7ae334e123a" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_d4c55fef451762d1d4b35ee14d9" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "request_assets" ADD CONSTRAINT "FK_84d03e4c2a4ee0f164fc0199278" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "request_assets" ADD CONSTRAINT "FK_17603ea6af27dd558965f44f85b" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "request_assets" DROP CONSTRAINT "FK_17603ea6af27dd558965f44f85b"`);
        await queryRunner.query(`ALTER TABLE "request_assets" DROP CONSTRAINT "FK_84d03e4c2a4ee0f164fc0199278"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_d4c55fef451762d1d4b35ee14d9"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_10ee4c4ea6cbd83e7ae334e123a"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_0bfd03d4c7a6067e1f88bb87c95"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_f350eb49ac489490d6085bdd2e1"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_2ba089a75d8f797d36a14fc626e"`);
        await queryRunner.query(`ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_56d00dc614fa435a3d82eabcca7"`);
        await queryRunner.query(`ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_547666e1a8794dd88492234682c"`);
        await queryRunner.query(`ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_e5a4d27d88d817600ce3d11ac7a"`);
        await queryRunner.query(`ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_20f5f36371be383c2a3d053904b"`);
        await queryRunner.query(`ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_787d70e1c1afe9025a5eb0592c9"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_b2c0d21afd92aa80e830800cec8"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_4d0eb99271d89c2ad45f1f8dc21"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_ab08d6c2ace44e63a55da44b9a7"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_4241f21b9bb35e82a6217af1aad"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_80e310e761f458f272c20ea6add"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_1bbd34899b8e74ef2a7f3212806"`);
        await queryRunner.query(`DROP TABLE "request_assets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_59b85be6a3c16cbf27f8bdda1d"`);
        await queryRunner.query(`DROP TABLE "requests"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb7811df2b609f718f0000cf45"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_inventory_items_serial_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b7dd3183ac78e8b50436629026"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_787d70e1c1afe9025a5eb0592c"`);
        await queryRunner.query(`DROP TABLE "inventory_items"`);
        await queryRunner.query(`DROP TYPE "public"."inventory_items_location_enum"`);
        await queryRunner.query(`DROP TYPE "public"."inventory_items_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_assets_category"`);
        await queryRunner.query(`DROP TABLE "assets"`);
        await queryRunner.query(`DROP TYPE "public"."assets_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_15b3fe608b52f34df363512e39"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ace513fa30d485cfd25c11a9e4"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}

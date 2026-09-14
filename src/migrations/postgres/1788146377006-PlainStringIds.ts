import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlainStringIds1788146377006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "users_clientId_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "id" TYPE varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "clientId" TYPE varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "id" TYPE varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "users_clientId_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "id" TYPE uuid USING "id"::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "id" TYPE uuid USING "id"::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "clientId" TYPE uuid USING "clientId"::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id")`,
    );
  }
}

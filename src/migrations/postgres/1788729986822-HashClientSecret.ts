import { MigrationInterface, QueryRunner } from 'typeorm';

export class HashClientSecret1788729986822 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" RENAME COLUMN "clientSecretEncrypted" TO "clientSecretHash"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" RENAME COLUMN "clientSecretHash" TO "clientSecretEncrypted"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClients1788139936061 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid PRIMARY KEY,
        "clientSecretEncrypted" varchar NOT NULL,
        "name" varchar NOT NULL,
        "allowedScopes" text[] NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "clients"`);
  }
}

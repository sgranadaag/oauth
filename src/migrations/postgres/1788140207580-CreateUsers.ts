import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1788140207580 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY,
        "clientId" uuid NOT NULL REFERENCES "clients"("id"),
        "username" varchar NOT NULL,
        "passwordHash" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_clientId_username" UNIQUE ("clientId", "username")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOidcModels1788141141982 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "oidc_models" (
        "id" varchar NOT NULL,
        "modelName" varchar NOT NULL,
        "payload" jsonb NOT NULL,
        "grantId" varchar,
        "userCode" varchar,
        "uid" varchar,
        "expiresAt" timestamptz,
        "consumedAt" timestamptz,
        CONSTRAINT "PK_oidc_models" PRIMARY KEY ("id", "modelName")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_oidc_models_grantId" ON "oidc_models" ("grantId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_oidc_models_userCode" ON "oidc_models" ("userCode")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_oidc_models_uid" ON "oidc_models" ("uid")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "oidc_models"`);
  }
}

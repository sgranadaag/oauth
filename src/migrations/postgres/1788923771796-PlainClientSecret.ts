import { MigrationInterface, QueryRunner } from 'typeorm';

// Client secrets are stored as issued rather than bcrypt-hashed, so the column
// is renamed to say what it now holds. Existing rows keep their old bcrypt
// digests, which no longer match anything a caller can submit — every client
// provisioned before this migration needs a new secret issued.
export class PlainClientSecret1788923771796 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" RENAME COLUMN "clientSecretHash" TO "clientSecret"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" RENAME COLUMN "clientSecret" TO "clientSecretHash"`,
    );
  }
}

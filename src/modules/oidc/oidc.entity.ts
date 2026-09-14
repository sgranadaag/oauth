import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('oidc_models')
export class OidcModelEntity {
  @PrimaryColumn()
  id: string;

  @PrimaryColumn()
  modelName: string;

  @Column('jsonb')
  payload: Record<string, unknown>;

  @Column({ nullable: true })
  grantId?: string;

  @Column({ nullable: true })
  userCode?: string;

  @Column({ nullable: true })
  uid?: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt?: Date;
}

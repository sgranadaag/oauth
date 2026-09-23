import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectIdColumn,
} from 'typeorm';
import type { ObjectId } from 'mongodb';

@Entity('clients')
export class ClientEntity {
  @ObjectIdColumn()
  _id: ObjectId;

  @Index({ unique: true })
  @Column()
  id: string;

  @Column()
  clientSecret: string;

  @Column()
  name: string;

  @Column()
  allowedScopes: string[];

  @Column()
  redirectUris: string[];

  @Column()
  grantTypes: string[];

  @Column({ nullable: true })
  accessTokenTtlSeconds: number | null;

  @CreateDateColumn()
  createdAt: Date;
}

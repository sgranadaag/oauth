import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectIdColumn,
} from 'typeorm';
import type { ObjectId } from 'mongodb';

@Entity('authorization_requests')
export class CodeRequestEntity {
  @ObjectIdColumn()
  _id: ObjectId;

  @Index({ unique: true })
  @Column()
  id: string;

  @Column()
  clientId: string;

  @Column()
  redirectUri: string;

  @Column()
  scope: string;

  @Column({ nullable: true })
  state: string | null;

  @Column({ nullable: true })
  nonce: string | null;

  @Column()
  codeChallenge: string;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

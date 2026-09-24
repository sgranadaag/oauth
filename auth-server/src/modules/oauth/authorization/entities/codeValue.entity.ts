import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectIdColumn,
} from 'typeorm';
import type { ObjectId } from 'mongodb';

@Entity('authorization_codes')
export class CodeValueEntity {
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
  userId: string;

  @Column()
  email: string;

  @Column()
  scope: string;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectIdColumn,
} from 'typeorm';
import type { ObjectId } from 'mongodb';

@Entity('tokens')
export class TokenEntity {
  @ObjectIdColumn()
  _id: ObjectId;

  @Index({ unique: true })
  @Column()
  id: string;

  @Column()
  type: string;

  @Column()
  clientId: string;

  @Column()
  userId: string;

  @Index()
  @Column()
  sessionId: string;

  @Column()
  sessionExpiresAt: Date;

  @Column()
  scope: string;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

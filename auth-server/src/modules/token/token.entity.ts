import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectId,
  ObjectIdColumn,
} from 'typeorm';

// One document per refresh token issued. `id` *is* the value handed to the
// client: 256 bits of randomness, so the lookup is an indexed read and there is
// nothing to decode. Access tokens are not stored — they are JWTs, verified
// offline against the public key, and a row for them would be read by nobody.
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

  // Every token rotated from the same original shares this. Reusing a consumed
  // token revokes the whole session by it, so a stolen refresh token cannot
  // outlive the rotation that replaced it.
  @Index()
  @Column()
  sessionId: string;

  @Column()
  scope: string;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

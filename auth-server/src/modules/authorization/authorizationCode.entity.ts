import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectIdColumn,
} from 'typeorm';
import type { ObjectId } from 'mongodb';

// A code the person's sign-in produced, waiting to be exchanged. `id` is the
// value the client receives. It is bound to everything the exchange has to
// match: the client, the exact redirect URI, and the PKCE challenge only the
// client that started the flow can answer.
@Entity('authorization_codes')
export class AuthorizationCodeEntity {
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
  codeChallenge: string;

  @Column({ nullable: true })
  nonce: string | null;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

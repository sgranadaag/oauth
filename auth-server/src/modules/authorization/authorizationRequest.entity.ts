import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectIdColumn,
} from 'typeorm';
import type { ObjectId } from 'mongodb';

// An authorization request that has been validated and is waiting for the
// person to sign in. It exists so the login page never has to carry the
// client's parameters itself: it holds only this document's id, and everything
// that decides where the code goes stays on the server, out of reach of a
// tampered URL.
@Entity('authorization_requests')
export class AuthorizationRequestEntity {
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

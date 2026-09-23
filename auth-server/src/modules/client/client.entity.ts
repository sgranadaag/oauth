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

  // Which grants this client may use (RFC 7591 `grant_types`). A client
  // registered for the code flow cannot also ask for client_credentials
  // unless it says so here.
  @Column()
  grantTypes: string[];

  // Lifetime of the access tokens issued for this client. `null` means the
  // server's default: a client may shorten or lengthen its own tokens without
  // touching anyone else's.
  @Column({ nullable: true })
  accessTokenTtlSeconds: number | null;

  @CreateDateColumn()
  createdAt: Date;
}

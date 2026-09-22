import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectId,
  ObjectIdColumn,
} from 'typeorm';

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

  @CreateDateColumn()
  createdAt: Date;
}

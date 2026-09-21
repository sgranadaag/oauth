import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectId,
  ObjectIdColumn,
} from 'typeorm';

// `_id` is Mongo's own key and nothing in this codebase reads it: TypeORM
// coerces any value used against an `@ObjectIdColumn` into an ObjectId, which a
// UUID is not. `id` stays the plain string identifier every other document
// references, with a unique index standing in for the primary key.
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

  @CreateDateColumn()
  createdAt: Date;
}

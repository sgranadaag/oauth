import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectId,
  ObjectIdColumn,
} from 'typeorm';

// No relation to ClientEntity: TypeORM has no joins on MongoDB, so the parent
// is the `clientId` string and nothing else. The compound index is what makes
// an email unique *per client* rather than globally.
@Entity('users')
@Index(['clientId', 'email'], { unique: true })
export class UserEntity {
  @ObjectIdColumn()
  _id: ObjectId;

  @Index({ unique: true })
  @Column()
  id: string;

  @Column()
  clientId: string;

  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;
}

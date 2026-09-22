import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectId,
  ObjectIdColumn,
} from 'typeorm';

// A person exists once, whichever application they sign in to: the email is
// unique across the whole provider, and no client appears here — which clients
// a person uses belongs to the oauth side, not to identity.
@Entity('users')
export class UserEntity {
  @ObjectIdColumn()
  _id: ObjectId;

  @Index({ unique: true })
  @Column()
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;
}

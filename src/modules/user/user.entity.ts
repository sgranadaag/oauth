import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { ClientEntity } from '../client/client.entity';

@Entity('users')
@Unique(['clientId', 'email'])
export class UserEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  clientId: string;

  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({ name: 'clientId' })
  client: ClientEntity;
}

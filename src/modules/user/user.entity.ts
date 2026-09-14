import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { ClientEntity } from '@modules/client/client.entity';

@Entity('users')
@Unique(['clientId', 'username'])
export class UserEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  clientId: string;

  @Column()
  username: string;

  @Column()
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({ name: 'clientId' })
  client: ClientEntity;
}

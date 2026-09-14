import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('clients')
export class ClientEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  clientSecret: string;

  @Column()
  name: string;

  @Column('text', { array: true })
  allowedScopes: string[];

  @CreateDateColumn()
  createdAt: Date;
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientEntity } from '@modules/client/client.entity';
import { ClientController } from '@modules/client/client.controller';
import { ClientRepository } from '@modules/client/client.repository';
import { ClientService } from '@modules/client/client.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientEntity])],
  controllers: [ClientController],
  providers: [ClientRepository, ClientService],
  exports: [ClientRepository],
})
export class ClientModule {}

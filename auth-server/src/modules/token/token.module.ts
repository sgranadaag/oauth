import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenEntity } from '@modules/token/token.entity';
import { TokenRepository } from '@modules/token/token.repository';
import { TokenService } from '@modules/token/token.service';

@Module({
  imports: [TypeOrmModule.forFeature([TokenEntity])],
  providers: [TokenRepository, TokenService],
  exports: [TokenRepository, TokenService],
})
export class TokenModule {}

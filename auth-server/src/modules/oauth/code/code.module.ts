import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeEntity } from '@modules/oauth/code/entities/code.entity';
import { CodeRequestEntity } from '@modules/oauth/code/entities/codeRequest.entity';
import { CodeRepository } from '@modules/oauth/code/code.repository';
import { CodeService } from '@modules/oauth/code/code.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CodeRequestEntity,
      CodeEntity,
    ]),
  ],
  providers: [CodeRepository, CodeService],
  exports: [CodeService],
})
export class CodeModule {}

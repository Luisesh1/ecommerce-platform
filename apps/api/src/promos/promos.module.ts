import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PromosService } from './promos.service';
import { PromosController } from './promos.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PromosController],
  providers: [PromosService],
  exports: [PromosService],
})
export class PromosModule {}

import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TaxService } from './tax.service';
import { TaxController } from './tax.controller';

@Module({
  imports: [RedisModule],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}

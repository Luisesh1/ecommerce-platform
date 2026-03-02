import { Module, OnModuleInit } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { FeaturesController } from './features.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [FeaturesController],
  providers: [FeaturesService],
  exports: [FeaturesService],
})
export class FeaturesModule implements OnModuleInit {
  constructor(private readonly featuresService: FeaturesService) {}

  async onModuleInit() {
    await this.featuresService.seedDefaults();
  }
}

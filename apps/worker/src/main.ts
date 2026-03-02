import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });
  const logger = new Logger('Worker');

  await app.init(); // Don't listen on a port - just process queues
  logger.log('Worker started, processing queues...');

  process.on('SIGTERM', async () => {
    logger.warn('SIGTERM received, shutting down...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.warn('SIGINT received, shutting down...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch(console.error);

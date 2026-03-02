import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsService } from './products/products.service';
import { ProductsController } from './products/products.controller';
import { CategoriesService } from './categories/categories.service';
import { CategoriesController } from './categories/categories.controller';
import { CollectionsService } from './collections/collections.service';
import { CollectionsController } from './collections/collections.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController, CategoriesController, CollectionsController],
  providers: [ProductsService, CategoriesService, CollectionsService],
  exports: [ProductsService, CategoriesService, CollectionsService],
})
export class CatalogModule {}

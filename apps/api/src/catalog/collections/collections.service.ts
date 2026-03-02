import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.collection.findMany({
      include: {
        products: {
          include: {
            product: {
              include: { images: { take: 1 }, variants: { take: 1 } },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: { orderBy: { sortOrder: 'asc' } },
                variants: { include: { inventoryLevel: true } },
                category: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!collection) throw new NotFoundException(`Collection "${slug}" not found`);
    return collection;
  }

  async findById(id: string) {
    const collection = await this.prisma.collection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundException(`Collection ${id} not found`);
    return collection;
  }

  async create(dto: CreateCollectionDto) {
    const existing = await this.prisma.collection.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Collection with slug "${dto.slug}" already exists`);

    const { productIds, ...collectionData } = dto;

    const collection = await this.prisma.$transaction(async (tx) => {
      const created = await tx.collection.create({
        data: {
          title: collectionData.title,
          slug: collectionData.slug,
          description: collectionData.description,
          imageUrl: collectionData.imageUrl,
          sortOrder: collectionData.sortOrder ?? 'MANUAL',
          isActive: collectionData.isActive ?? true,
          seoTitle: collectionData.seoTitle,
          seoDescription: collectionData.seoDescription,
        },
      });

      if (productIds && productIds.length > 0) {
        await tx.collectionProduct.createMany({
          data: productIds.map((productId, position) => ({
            collectionId: created.id,
            productId,
            position,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    this.logger.log(`Created collection: ${collection.id}`);
    return this.findBySlug(collection.slug);
  }

  async update(id: string, dto: UpdateCollectionDto) {
    await this.findById(id);

    if (dto.slug) {
      const existing = await this.prisma.collection.findUnique({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Collection with slug "${dto.slug}" already exists`);
      }
    }

    const { productIds, ...updateData } = dto;

    await this.prisma.$transaction(async (tx) => {
      await tx.collection.update({
        where: { id },
        data: {
          ...(updateData.title !== undefined && { title: updateData.title }),
          ...(updateData.slug !== undefined && { slug: updateData.slug }),
          ...(updateData.description !== undefined && { description: updateData.description }),
          ...(updateData.imageUrl !== undefined && { imageUrl: updateData.imageUrl }),
          ...(updateData.sortOrder !== undefined && { sortOrder: updateData.sortOrder }),
          ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
          ...(updateData.seoTitle !== undefined && { seoTitle: updateData.seoTitle }),
          ...(updateData.seoDescription !== undefined && { seoDescription: updateData.seoDescription }),
        },
      });

      if (productIds !== undefined) {
        await tx.collectionProduct.deleteMany({ where: { collectionId: id } });
        if (productIds.length > 0) {
          await tx.collectionProduct.createMany({
            data: productIds.map((productId, position) => ({
              collectionId: id,
              productId,
              position,
            })),
          });
        }
      }
    });

    this.logger.log(`Updated collection: ${id}`);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.collection.delete({ where: { id } });
    this.logger.log(`Deleted collection: ${id}`);
  }

  async addProduct(collectionId: string, productId: string): Promise<void> {
    await this.findById(collectionId);
    const lastItem = await this.prisma.collectionProduct.findFirst({
      where: { collectionId },
      orderBy: { position: 'desc' },
    });
    await this.prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId, productId } },
      create: { collectionId, productId, position: (lastItem?.position ?? -1) + 1 },
      update: {},
    });
  }

  async removeProduct(collectionId: string, productId: string): Promise<void> {
    await this.prisma.collectionProduct.delete({
      where: { collectionId_productId: { collectionId, productId } },
    });
  }
}

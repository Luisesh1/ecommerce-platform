import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { ProductStatus } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  private readonly productInclude = {
    category: { select: { id: true, name: true, slug: true } },
    variants: {
      include: {
        inventoryLevel: true,
        images: true,
      },
      orderBy: { position: 'asc' as const },
    },
    images: { orderBy: { sortOrder: 'asc' as const } },
    tags: { include: { tag: true } },
    attributes: { orderBy: { sortOrder: 'asc' as const } },
  };

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ProductFilterDto) {
    const { page = 1, limit = 20, categoryId, categoria, status, tag, vendor, search, q, minPrice, maxPrice, sort, inStock } = filters as any;
    const skip = (page - 1) * limit;

    const where: any = { status: ProductStatus.ACTIVE };

    if (categoryId) where.categoryId = categoryId;
    if (categoria) {
      const slugs = (categoria as string).split(',').map((s: string) => s.trim());
      where.category = { slug: { in: slugs } };
    }
    if (status) where.status = status;
    if (vendor) where.vendor = { contains: vendor, mode: 'insensitive' };
    const searchTerm = (search || q || '').trim();
    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { vendor: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    if (tag) {
      where.tags = { some: { tag: { slug: tag } } };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.variants = {
        some: {
          price: {
            ...(minPrice !== undefined && { gte: minPrice }),
            ...(maxPrice !== undefined && { lte: maxPrice }),
          },
        },
      };
    }

    if (inStock) {
      where.variants = { some: { inventoryLevel: { quantity: { gt: 0 } } } };
    }

    // Sort
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    else if (sort === 'name_asc') orderBy = { title: 'asc' };
    else if (sort === 'name_desc') orderBy = { title: 'desc' };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: this.productInclude,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    if (sort === 'price_asc') (products as any[]).sort((a, b) => (a.variants[0]?.price || 0) - (b.variants[0]?.price || 0));
    if (sort === 'price_desc') (products as any[]).sort((a, b) => (b.variants[0]?.price || 0) - (a.variants[0]?.price || 0));

    return buildPaginatedResponse(products, total, page, limit);
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: this.productInclude,
    });

    if (!product) throw new NotFoundException(`Product with slug "${slug}" not found`);
    return product;
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.productInclude,
    });

    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Product with slug "${dto.slug}" already exists`);

    const { tags, variants, ...productData } = dto;

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...productData,
          status: productData.status ?? ProductStatus.DRAFT,
          taxable: productData.taxable ?? true,
          requiresShipping: productData.requiresShipping ?? true,
        },
      });

      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          const slug = tagName.toLowerCase().replace(/\s+/g, '-');
          const tag = await tx.productTag.upsert({
            where: { slug },
            create: { name: tagName, slug },
            update: {},
          });
          await tx.productTagOnProduct.create({
            data: { productId: created.id, tagId: tag.id },
          });
        }
      }

      if (variants && variants.length > 0) {
        for (let i = 0; i < variants.length; i++) {
          const variantData = variants[i];
          const existingVariant = await tx.productVariant.findUnique({ where: { sku: variantData.sku } });
          if (existingVariant) throw new ConflictException(`SKU "${variantData.sku}" already exists`);

          const variant = await tx.productVariant.create({
            data: {
              productId: created.id,
              sku: variantData.sku,
              title: variantData.title,
              price: variantData.price,
              compareAtPrice: variantData.compareAtPrice,
              costPrice: variantData.costPrice,
              weight: variantData.weight,
              weightUnit: variantData.weightUnit,
              options: variantData.options ?? {},
              barcode: variantData.barcode,
              inventoryPolicy: variantData.inventoryPolicy,
              position: i,
            },
          });

          await tx.inventoryLevel.create({
            data: {
              variantId: variant.id,
              quantity: variantData.initialStock ?? 0,
            },
          });
        }
      }

      return created;
    });

    this.logger.log(`Created product: ${product.id} (${product.slug})`);
    return this.findById(product.id);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);

    if (dto.slug) {
      const existing = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product with slug "${dto.slug}" already exists`);
      }
    }

    const { tags, variants, ...productData } = dto;

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(productData.title !== undefined && { title: productData.title }),
          ...(productData.slug !== undefined && { slug: productData.slug }),
          ...(productData.description !== undefined && { description: productData.description }),
          ...(productData.shortDescription !== undefined && { shortDescription: productData.shortDescription }),
          ...(productData.status !== undefined && { status: productData.status }),
          ...(productData.vendor !== undefined && { vendor: productData.vendor }),
          ...(productData.productType !== undefined && { productType: productData.productType }),
          ...(productData.categoryId !== undefined && { categoryId: productData.categoryId }),
          ...(productData.seoTitle !== undefined && { seoTitle: productData.seoTitle }),
          ...(productData.seoDescription !== undefined && { seoDescription: productData.seoDescription }),
          ...(productData.seoKeywords !== undefined && { seoKeywords: productData.seoKeywords }),
          ...(productData.taxable !== undefined && { taxable: productData.taxable }),
          ...(productData.taxCode !== undefined && { taxCode: productData.taxCode }),
          ...(productData.requiresShipping !== undefined && { requiresShipping: productData.requiresShipping }),
          ...(productData.weight !== undefined && { weight: productData.weight }),
          ...(productData.weightUnit !== undefined && { weightUnit: productData.weightUnit }),
        },
      });

      if (tags !== undefined) {
        await tx.productTagOnProduct.deleteMany({ where: { productId: id } });
        for (const tagName of tags) {
          const slug = tagName.toLowerCase().replace(/\s+/g, '-');
          const tag = await tx.productTag.upsert({
            where: { slug },
            create: { name: tagName, slug },
            update: {},
          });
          await tx.productTagOnProduct.create({
            data: { productId: id, tagId: tag.id },
          });
        }
      }
    });

    this.logger.log(`Updated product: ${id}`);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.product.delete({ where: { id } });
    this.logger.log(`Deleted product: ${id}`);
  }

  async addImage(
    productId: string,
    url: string,
    altText?: string,
    variantId?: string,
  ) {
    await this.findById(productId);

    const lastImage = await this.prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = (lastImage?.sortOrder ?? -1) + 1;

    return this.prisma.productImage.create({
      data: { productId, url, altText, variantId, sortOrder },
    });
  }

  async deleteImage(productId: string, imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId) {
      throw new NotFoundException('Image not found');
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });
  }
}

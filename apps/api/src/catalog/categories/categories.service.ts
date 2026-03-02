import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Category } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderItemDto } from './dto/reorder-categories.dto';

export interface CategoryTree extends Category {
  children: CategoryTree[];
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  slug: string;
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent category ${dto.parentId} not found`);
      }
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
    });

    this.logger.log(`Created category: ${category.id} (${category.slug})`);
    return category;
  }

  async findAll(): Promise<CategoryTree[]> {
    const all = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return this.buildCategoryTree(all);
  }

  async findAllFlat(): Promise<Category[]> {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findBySlug(slug: string): Promise<CategoryTree> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }

    const allDescendants = await this.getDescendants(category.id);
    const treeNode = this.buildCategoryTree([category, ...allDescendants]);
    return treeNode[0] ?? { ...category, children: [] };
  }

  async findById(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findById(id);

    if (dto.slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
      }
    }

    if (dto.parentId && dto.parentId === id) {
      throw new ConflictException('A category cannot be its own parent');
    }

    if (dto.parentId) {
      const isDescendant = await this.isDescendantOf(dto.parentId, id);
      if (isDescendant) {
        throw new ConflictException('Cannot set a descendant as the parent (circular reference)');
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
      },
    });

    this.logger.log(`Updated category: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    const children = await this.prisma.category.findMany({
      where: { parentId: id },
    });
    if (children.length > 0) {
      throw new ConflictException(
        'Cannot delete category with subcategories. Remove or reassign subcategories first.',
      );
    }

    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete category with ${productCount} associated products. Reassign products first.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    this.logger.log(`Deleted category: ${id}`);
  }

  async reorder(items: ReorderItemDto[]): Promise<void> {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.category.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    this.logger.log(`Reordered ${items.length} categories`);
  }

  async getBreadcrumb(categoryId: string): Promise<BreadcrumbItem[]> {
    const breadcrumb: BreadcrumbItem[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, slug: true, parentId: true },
      });

      if (!category) break;

      breadcrumb.unshift({
        id: category.id,
        name: category.name,
        slug: category.slug,
      });

      currentId = category.parentId;
    }

    return breadcrumb;
  }

  buildCategoryTree(categories: Category[], parentId: string | null = null): CategoryTree[] {
    return categories
      .filter((cat) => cat.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cat) => ({
        ...cat,
        children: this.buildCategoryTree(categories, cat.id),
      }));
  }

  private async getDescendants(categoryId: string): Promise<Category[]> {
    const descendants: Category[] = [];
    const queue: string[] = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.prisma.category.findMany({
        where: { parentId: currentId },
      });
      descendants.push(...children);
      queue.push(...children.map((c) => c.id));
    }

    return descendants;
  }

  private async isDescendantOf(potentialDescendantId: string, ancestorId: string): Promise<boolean> {
    const descendants = await this.getDescendants(ancestorId);
    return descendants.some((d) => d.id === potentialDescendantId);
  }
}

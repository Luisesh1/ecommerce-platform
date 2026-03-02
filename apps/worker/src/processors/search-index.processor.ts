import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import MeiliSearch from 'meilisearch';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

const PRODUCTS_INDEX = 'products';
const BATCH_SIZE = 100;

export interface IndexProductJobData {
  productId: string;
}

export interface DeleteProductJobData {
  productId: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SyncAllJobData {}

interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  descriptionShort: string | null;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  brandId: string | null;
  brandName: string | null;
  tags: string[];
  imageUrl: string | null;
  priceCents: number;
  salePriceCents: number | null;
  inStock: boolean;
  totalStock: number;
  variantCount: number;
  createdAt: number; // unix timestamp for sorting
  updatedAt: number;
}

@Processor('search-index')
export class SearchIndexProcessor {
  private readonly logger = new Logger(SearchIndexProcessor.name);
  private readonly meili: MeiliSearch;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.meili = new MeiliSearch({
      host: this.configService.get<string>('MEILISEARCH_URL', 'http://localhost:7700'),
      apiKey: this.configService.get<string>('MEILISEARCH_KEY'),
    });
  }

  /** Fetch, format, and upsert a single product into Meilisearch */
  @Process('index-product')
  async handleIndexProduct(job: Job<IndexProductJobData>): Promise<void> {
    const { productId } = job.data;
    this.logger.debug(`Indexing product ${productId}`);

    const product = await this.fetchProduct(productId);
    if (!product) {
      this.logger.warn(`Product ${productId} not found — skipping index`);
      return;
    }

    if (product.status !== 'ACTIVE') {
      // Remove inactive products from the index
      await this.deleteFromIndex(productId);
      this.logger.debug(`Product ${productId} is ${product.status} — removed from index`);
      return;
    }

    const doc = this.formatDocument(product);
    const index = this.meili.index(PRODUCTS_INDEX);
    await index.addDocuments([doc], { primaryKey: 'id' });
    await this.ensureIndexSettings(index);

    this.logger.log(`Product ${productId} indexed in Meilisearch`);
  }

  /** Remove a product from the Meilisearch index */
  @Process('delete-product')
  async handleDeleteProduct(job: Job<DeleteProductJobData>): Promise<void> {
    const { productId } = job.data;
    await this.deleteFromIndex(productId);
    this.logger.log(`Product ${productId} deleted from Meilisearch index`);
  }

  /** Full re-sync of all active products */
  @Process('sync-all')
  async handleSyncAll(job: Job<SyncAllJobData>): Promise<void> {
    this.logger.log('Starting full search index sync...');

    let offset = 0;
    let total = 0;

    const index = this.meili.index(PRODUCTS_INDEX);
    await this.ensureIndexSettings(index);

    while (true) {
      const products = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        skip: offset,
        take: BATCH_SIZE,
        include: this.productInclude(),
      });

      if (products.length === 0) break;

      const docs = products.map((p) => this.formatDocument(p as any));
      await index.addDocuments(docs, { primaryKey: 'id' });

      total += products.length;
      offset += products.length;

      await job.progress(Math.round((total / (total + 1)) * 100));
      this.logger.debug(`Synced batch: ${total} products indexed so far`);
    }

    this.logger.log(`Full sync complete: ${total} products indexed`);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async fetchProduct(productId: string) {
    return this.prisma.product.findUnique({
      where: { id: productId },
      include: this.productInclude(),
    });
  }

  private productInclude() {
    return {
      category: true,
      brand: true,
      images: { take: 1, orderBy: { position: 'asc' as const } },
      tags: { include: { tag: true } },
      variants: {
        where: { isActive: true },
        select: {
          id: true,
          priceCents: true,
          salePriceCents: true,
          stockQuantity: true,
          reservedQuantity: true,
          isActive: true,
        },
      },
    };
  }

  private formatDocument(product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    descriptionShort: string | null;
    status: string;
    category: { id: string; name: string; slug: string } | null;
    brand: { id: string; name: string } | null;
    images: Array<{ url: string }>;
    tags: Array<{ tag: { name: string } }>;
    variants: Array<{
      priceCents: number;
      salePriceCents: number | null;
      stockQuantity: number;
      reservedQuantity: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): SearchProduct {
    const activeVariants = product.variants;
    const prices = activeVariants.map((v) => v.priceCents);
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const salePrices = activeVariants
      .map((v) => v.salePriceCents)
      .filter((p): p is number => p !== null);
    const lowestSalePrice = salePrices.length > 0 ? Math.min(...salePrices) : null;

    const totalStock = activeVariants.reduce(
      (sum, v) => sum + Math.max(0, v.stockQuantity - v.reservedQuantity),
      0,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      descriptionShort: product.descriptionShort,
      status: product.status,
      categoryId: product.category?.id ?? null,
      categoryName: product.category?.name ?? null,
      categorySlug: product.category?.slug ?? null,
      brandId: product.brand?.id ?? null,
      brandName: product.brand?.name ?? null,
      tags: product.tags.map((t) => t.tag.name),
      imageUrl: product.images[0]?.url ?? null,
      priceCents: lowestPrice,
      salePriceCents: lowestSalePrice,
      inStock: totalStock > 0,
      totalStock,
      variantCount: activeVariants.length,
      createdAt: Math.floor(product.createdAt.getTime() / 1000),
      updatedAt: Math.floor(product.updatedAt.getTime() / 1000),
    };
  }

  private async deleteFromIndex(productId: string): Promise<void> {
    const index = this.meili.index(PRODUCTS_INDEX);
    await index.deleteDocument(productId);
  }

  private async ensureIndexSettings(index: ReturnType<MeiliSearch['index']>): Promise<void> {
    try {
      await index.updateSettings({
        searchableAttributes: ['name', 'description', 'descriptionShort', 'tags', 'brandName', 'categoryName'],
        filterableAttributes: ['categoryId', 'categorySlug', 'brandId', 'status', 'inStock', 'tags'],
        sortableAttributes: ['priceCents', 'createdAt', 'updatedAt', 'totalStock'],
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness',
        ],
        pagination: { maxTotalHits: 10000 },
      });
    } catch (err) {
      // Non-fatal — settings update can fail on concurrent calls
      this.logger.warn(`Failed to update index settings: ${(err as Error).message}`);
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Search index job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }
}

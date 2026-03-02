import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MeiliSearchDefault, { MeiliSearch } from 'meilisearch';

export interface SearchProduct {
  id: string;
  title: string;
  slug: string;
  description?: string;
  vendor?: string;
  categoryId?: string;
  status: string;
  minPrice: number;
  maxPrice: number;
  tags: string[];
  imageUrl?: string;
  inStock: boolean;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: MeiliSearch;
  private readonly indexName = 'products';

  constructor(private configService: ConfigService) {
    this.client = new MeiliSearchDefault({
      host: this.configService.get<string>('MEILISEARCH_HOST', 'http://localhost:7700'),
      apiKey: this.configService.get<string>('MEILISEARCH_API_KEY', ''),
    });
  }

  async onModuleInit() {
    try {
      const index = this.client.index(this.indexName);
      await index.updateSettings({
        searchableAttributes: ['title', 'description', 'vendor', 'tags'],
        filterableAttributes: ['status', 'categoryId', 'inStock', 'minPrice', 'maxPrice'],
        sortableAttributes: ['minPrice', 'maxPrice', 'title'],
      });
      this.logger.log('MeiliSearch index configured');
    } catch (err) {
      this.logger.warn(`MeiliSearch init failed: ${(err as Error).message}`);
    }
  }

  async indexProduct(product: SearchProduct): Promise<void> {
    try {
      await this.client.index(this.indexName).addDocuments([product]);
    } catch (err) {
      this.logger.error(`Failed to index product ${product.id}: ${(err as Error).message}`);
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.client.index(this.indexName).deleteDocument(productId);
    } catch (err) {
      this.logger.error(`Failed to delete product ${productId} from index: ${(err as Error).message}`);
    }
  }

  async search(query: string, filters?: Record<string, unknown>): Promise<unknown> {
    try {
      return await this.client.index(this.indexName).search(query, filters as any);
    } catch (err) {
      this.logger.error(`Search failed: ${(err as Error).message}`);
      return { hits: [], estimatedTotalHits: 0 };
    }
  }
}

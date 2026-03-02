import { Controller, Get, Post, Delete, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search products' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'tags', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false })
  async searchProducts(
    @Query('q') query: string = '',
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('tags') tags?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('sort') sort?: string,
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const filter: string[] = ['status = "ACTIVE"'];
    if (category) filter.push(`categoryId = "${category}"`);
    if (minPrice) filter.push(`minPrice >= ${minPrice}`);
    if (maxPrice) filter.push(`maxPrice <= ${maxPrice}`);

    const filterStr = filter.join(' AND ');

    let sort_arr: string[] = [];
    if (sort) {
      const [field, direction] = sort.split(':');
      sort_arr = [`${field}:${direction || 'asc'}`];
    }

    return this.searchService.search(query, {
      filter: filterStr,
      limit: limitNum,
      offset,
      sort: sort_arr.length ? sort_arr : undefined,
    });
  }

  @Post('index/:productId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Index a product (admin)' })
  indexProduct(
    @Param('productId') productId: string,
    @Body() product: any,
  ) {
    return this.searchService.indexProduct(product);
  }

  @Delete('index/:productId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove product from search index (admin)' })
  deleteProductFromIndex(@Param('productId') productId: string) {
    return this.searchService.deleteProduct(productId);
  }
}

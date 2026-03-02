import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import {
  CreateReviewDto,
  UpdateReviewStatusDto,
  RespondToReviewDto,
  ReviewFilterDto,
} from './dto/review.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('product/:productId')
  @ApiOperation({ summary: 'Get product reviews' })
  getProductReviews(@Param('productId') productId: string, @Query() filters: ReviewFilterDto) {
    return this.reviewsService.getProductReviews(productId, filters);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get all reviews (admin)' })
  getAllReviews(@Query() filters: ReviewFilterDto) {
    return this.reviewsService.getAllReviews(filters);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review (authenticated, verified purchaser)' })
  createReview(@Body() dto: CreateReviewDto, @CurrentUser('id') userId: string) {
    return this.reviewsService.createReview(dto, userId);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update review status (admin)' })
  updateReviewStatus(@Param('id') id: string, @Body() dto: UpdateReviewStatusDto) {
    return this.reviewsService.updateReviewStatus(id, dto);
  }

  @Patch(':id/response')
  @ApiBearerAuth()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Respond to a review (admin)' })
  respondToReview(@Param('id') id: string, @Body() dto: RespondToReviewDto) {
    return this.reviewsService.respondToReview(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete review (admin)' })
  deleteReview(@Param('id') id: string) {
    return this.reviewsService.deleteReview(id);
  }
}

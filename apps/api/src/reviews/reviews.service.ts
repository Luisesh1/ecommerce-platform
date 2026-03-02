import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse } from '../common/dto/pagination.dto';
import {
  CreateReviewDto,
  UpdateReviewStatusDto,
  RespondToReviewDto,
  ReviewFilterDto,
} from './dto/review.dto';
import { ReviewStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProductReviews(productId: string, filters: ReviewFilterDto) {
    const { page = 1, limit = 20, status, minRating } = filters;
    const skip = (page - 1) * limit;

    const where: any = { productId, status: status ?? ReviewStatus.APPROVED };
    if (minRating) where.rating = { gte: minRating };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { images: true },
      }),
      this.prisma.review.count({ where }),
    ]);

    const ratingAgg = await this.prisma.review.aggregate({
      where: { productId, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      ...buildPaginatedResponse(reviews, total, page, limit),
      stats: {
        averageRating: ratingAgg._avg.rating ?? 0,
        totalReviews: ratingAgg._count.rating,
      },
    };
  }

  async createReview(dto: CreateReviewDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        customerId: userId,
        status: { in: ['DELIVERED', 'FULLY_REFUNDED', 'PARTIALLY_REFUNDED'] as any },
        lineItems: { some: { productId: dto.productId } },
      },
    });

    if (!order) {
      throw new ForbiddenException('You can only review products from completed orders');
    }

    const existing = await this.prisma.review.findUnique({
      where: { productId_customerId: { productId: dto.productId, customerId: userId } },
    });

    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    const review = await this.prisma.review.create({
      data: {
        productId: dto.productId,
        customerId: userId,
        orderId: dto.orderId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        status: ReviewStatus.PENDING,
        verifiedPurchase: true,
        authorName: `${user.firstName} ${user.lastName}`,
        authorEmail: user.email,
      },
    });

    this.logger.log(`Created review: ${review.id} for product ${dto.productId}`);
    return review;
  }

  async updateReviewStatus(id: string, dto: UpdateReviewStatusDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async respondToReview(id: string, dto: RespondToReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id },
      data: { adminResponse: dto.response, adminResponseAt: new Date() },
    });
  }

  async deleteReview(id: string): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    this.logger.log(`Deleted review: ${id}`);
  }

  async getAllReviews(filters: ReviewFilterDto) {
    const { page = 1, limit = 20, status } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { id: true, title: true, slug: true } },
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return buildPaginatedResponse(reviews, total, page, limit);
  }
}

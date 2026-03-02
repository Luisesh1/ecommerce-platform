import { ReviewStatus } from '../enums';

export interface Review {
  id: string;
  productId: string;
  customerId: string;
  orderId: string;
  rating: number;
  title?: string;
  body: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  helpfulCount: number;
  images: ReviewImage[];
  authorName: string;
  authorEmail: string;
  adminResponse?: string;
  adminResponseAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewImage {
  id: string;
  reviewId: string;
  url: string;
  altText?: string;
  sortOrder: number;
}

export interface ReviewStats {
  productId: string;
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

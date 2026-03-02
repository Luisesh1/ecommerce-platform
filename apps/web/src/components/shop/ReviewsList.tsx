"use client";
import { Star, ThumbsUp } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export interface Review {
  id: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  verified: boolean;
  helpfulCount?: number;
}

interface RatingSummary {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

interface ReviewsListProps {
  reviews: Review[];
  summary?: RatingSummary;
  isLoading?: boolean;
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-right text-xs text-neutral-500">{rating}</span>
      <Star className="h-3 w-3 fill-warning-500 text-warning-500" />
      <div className="flex-1 h-2 rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-warning-500 transition-all"
          style={{ width: `${count}%` }}
        />
      </div>
      <span className="w-8 text-xs text-neutral-400">{count}%</span>
    </div>
  );
}

export function ReviewsList({ reviews, summary, isLoading }: ReviewsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 border-b border-neutral-100 pb-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary */}
      {summary && (
        <div className="flex flex-col sm:flex-row gap-6 p-6 rounded-xl bg-neutral-50">
          <div className="flex flex-col items-center justify-center">
            <span className="text-5xl font-bold text-neutral-900">
              {summary.average.toFixed(1)}
            </span>
            <div className="flex gap-0.5 my-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-5 w-5',
                    i < Math.round(summary.average)
                      ? 'fill-warning-500 text-warning-500'
                      : 'fill-neutral-200 text-neutral-200'
                  )}
                />
              ))}
            </div>
            <span className="text-sm text-neutral-500">{summary.total} resenas</span>
          </div>
          <div className="flex-1 space-y-1.5">
            {([5, 4, 3, 2, 1] as const).map((rating) => (
              <StarRow
                key={rating}
                rating={rating}
                count={summary.distribution[rating] || 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Individual reviews */}
      {reviews.length === 0 ? (
        <p className="text-center text-neutral-500 py-8">
          Aun no hay resenas. Se el primero en opinar.
        </p>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-neutral-100 pb-6 last:border-0">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex gap-0.5 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-4 w-4',
                          i < review.rating
                            ? 'fill-warning-500 text-warning-500'
                            : 'fill-neutral-200 text-neutral-200'
                        )}
                      />
                    ))}
                  </div>
                  <h4 className="font-semibold text-neutral-900">{review.title}</h4>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-neutral-700">{review.author}</p>
                  <p className="text-xs text-neutral-400">{formatDate(review.createdAt, { month: 'short' })}</p>
                  {review.verified && (
                    <span className="text-xs text-success-600 font-medium">Compra verificada</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">{review.body}</p>
              {review.helpfulCount !== undefined && (
                <button className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Util ({review.helpfulCount})
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

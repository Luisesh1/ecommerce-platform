"use client";
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  productCount?: number;
}

interface CategoryGridProps {
  categories: Category[];
  isLoading?: boolean;
  className?: string;
}

function CategorySkeleton() {
  return (
    <div className="rounded-xl overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-3">
        <Skeleton className="h-4 w-3/4 mx-auto" />
      </div>
    </div>
  );
}

export function CategoryGrid({ categories, isLoading, className }: CategoryGridProps) {
  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <CategorySkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4', className)}>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/productos?categoria=${category.slug}`}
          className="group flex flex-col items-center no-underline"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
            {category.image ? (
              <Image
                src={category.image}
                alt={category.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
                <span className="text-3xl font-bold text-brand-600">
                  {category.name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 text-center">
            <p className="text-sm font-semibold text-neutral-800 group-hover:text-brand-600 transition-colors">
              {category.name}
            </p>
            {category.productCount !== undefined && (
              <p className="text-xs text-neutral-400">{category.productCount} productos</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

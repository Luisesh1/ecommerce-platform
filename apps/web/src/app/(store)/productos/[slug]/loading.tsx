import { Skeleton } from '@/components/ui/Skeleton';

export default function ProductDetailLoading() {
  return (
    <div className="container-page py-8 space-y-16">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">
        {/* Gallery skeleton */}
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-lg shrink-0" />
            ))}
          </div>
        </div>

        {/* Product info skeleton */}
        <div className="space-y-6">
          {/* Brand + title */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
            {/* Stars */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-4 w-4 rounded" />
                ))}
              </div>
              <Skeleton className="h-4 w-28" />
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>

          {/* Stock badge */}
          <Skeleton className="h-8 w-32 rounded-full" />

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>

          {/* Variant options */}
          <div className="border-t border-neutral-100 pt-4 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-16" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9 w-14 rounded" />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-12" />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            </div>
          </div>

          {/* Quantity + CTA */}
          <div className="border-t border-neutral-100 pt-4 space-y-3">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-12 w-full rounded" />
          </div>

          {/* SKU */}
          <Skeleton className="h-3 w-24" />

          {/* Shipping estimator */}
          <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="flex-1 h-9 rounded" />
              <Skeleton className="h-9 w-20 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Reviews section skeleton */}
      <div className="border-t border-neutral-200 pt-12">
        <Skeleton className="h-7 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            <Skeleton className="h-32 w-full rounded-xl" />
            {/* Reviews */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b border-neutral-100 pb-6 space-y-2">
                <div className="flex justify-between">
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Skeleton key={s} className="h-4 w-4 rounded" />
                      ))}
                    </div>
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-6 rounded" />
              ))}
            </div>
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-24 w-full rounded" />
            <Skeleton className="h-10 w-32 rounded" />
          </div>
        </div>
      </div>

      {/* Related products skeleton */}
      <div className="border-t border-neutral-200 pt-12">
        <Skeleton className="h-7 w-52 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-neutral-200 overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-24 mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: any[] }>('/categories'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFeaturedProducts(limit = 8) {
  return useQuery({
    queryKey: ['products', 'featured', limit],
    queryFn: () => api.get<{ data: any[] }>(`/products?limit=${limit}`),
    staleTime: 2 * 60 * 1000,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.get<any>(`/products/${slug}`),
    enabled: !!slug,
  });
}

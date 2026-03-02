import { ProductStatus, InventoryPolicy, WeightUnit, DimensionUnit } from '../enums';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  parent?: Category;
  children?: Category[];
  metaTitle?: string;
  metaDescription?: string;
  sortOrder: number;
  isActive: boolean;
  breadcrumb?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductTag {
  id: string;
  name: string;
  slug: string;
}

export interface ProductAttribute {
  id: string;
  productId: string;
  name: string;
  value: string;
  sortOrder: number;
}

export interface ProductImage {
  id: string;
  productId: string;
  variantId?: string;
  url: string;
  altText?: string;
  sortOrder: number;
  width?: number;
  height?: number;
  createdAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  inventoryQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  weight?: number;
  weightUnit: WeightUnit;
  requiresShipping: boolean;
  options: Record<string, string>;
  images?: ProductImage[];
  barcode?: string;
  inventoryPolicy: InventoryPolicy;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  status: ProductStatus;
  vendor?: string;
  productType?: string;
  categoryId?: string;
  category?: Category;
  tags: ProductTag[];
  images: ProductImage[];
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  minPrice: number;
  maxPrice: number;
  compareAtPrice?: number;
  totalInventory: number;
  hasMultipleVariants: boolean;
  options: Record<string, string[]>;
  weight?: number;
  weightUnit: WeightUnit;
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit: DimensionUnit;
  requiresShipping: boolean;
  taxable: boolean;
  taxCode?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Collection {
  id: string;
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder: string;
  isActive: boolean;
  products?: Product[];
  productCount?: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSearchResult {
  id: string;
  title: string;
  slug: string;
  minPrice: number;
  maxPrice: number;
  imageUrl?: string;
  category?: string;
  tags: string[];
  totalInventory: number;
  status: ProductStatus;
  vendor?: string;
  rating?: number;
  reviewCount?: number;
}

export interface SearchFacets {
  categories: { value: string; count: number }[];
  priceRange: { min: number; max: number };
  tags: { value: string; count: number }[];
  vendors: { value: string; count: number }[];
}

export interface SearchResults {
  hits: ProductSearchResult[];
  totalHits: number;
  facets: SearchFacets;
  processingTimeMs: number;
  query: string;
}

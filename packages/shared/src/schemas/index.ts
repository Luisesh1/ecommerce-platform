import { z } from 'zod';

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const SearchSchema = z.object({
  q: z.string().min(2).max(100),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  categories: z.string().optional(),
  tags: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
  sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'rating']).default('relevance'),
});

export const AddressSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  company: z.string().max(100).optional(),
  address1: z.string().min(1).max(200),
  address2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2),
  phone: z.string().max(20).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().length(6).optional(),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().max(20).optional(),
  marketingConsent: z.boolean().default(false),
});

export const CartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
});

export const CheckoutSchema = z.object({
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.optional(),
  sameAsShipping: z.boolean().default(true),
  shippingMethodId: z.string().uuid(),
  paymentMethod: z.string(),
  couponCode: z.string().optional(),
  notes: z.string().max(500).optional(),
  agreeToTerms: z.boolean().refine((val) => val === true, { message: 'Must agree to terms' }),
  marketingConsent: z.boolean().default(false),
});

export const ProductFilterSchema = z.object({
  status: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
  vendor: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  body: z.string().min(10).max(2000),
});

export const CouponSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;
export type SearchInput = z.infer<typeof SearchSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CartItemInput = z.infer<typeof CartItemSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
export type ReviewInput = z.infer<typeof ReviewSchema>;

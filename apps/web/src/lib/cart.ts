'use client';
import { createContext, useContext, useState, useEffect, ReactNode, createElement } from 'react';
import { api } from './api';

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
  sku: string;
  options: Record<string, string>;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode?: string;
  couponDiscount?: number;
}

interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  itemCount: number;
  addItem: (item: {
    productId: string;
    variantId: string;
    quantity: number;
  }) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const emptyCart: Cart = {
  id: '',
  items: [],
  subtotal: 0,
  discount: 0,
  shipping: 0,
  tax: 0,
  total: 0,
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCart = async () => {
    try {
      setIsLoading(true);
      const sessionId = getOrCreateSessionId();
      const data = await api.get<Cart>('/cart', { sessionId });
      if (data?.id) localStorage.setItem('cart_id', data.id);
      setCart(data);
    } catch {
      setCart(emptyCart);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const addItem = async (item: { productId?: string; variantId: string; quantity: number }) => {
    setIsLoading(true);
    try {
      const sessionId = getOrCreateSessionId();
      // Obtener o crear cart primero
      let cartId = localStorage.getItem('cart_id');
      if (!cartId) {
        const cart = await api.get<Cart>('/cart', { sessionId });
        if (cart?.id) { cartId = cart.id; localStorage.setItem('cart_id', cartId); }
      }
      const { productId, ...rest } = item;
      const data = await api.post<Cart>(`/cart/items?cartId=${cartId || ''}`, rest);
      if (data?.id) localStorage.setItem('cart_id', data.id);
      setCart(data);
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = async (itemId: string, quantity: number) => {
    setIsLoading(true);
    try {
      const cartId = localStorage.getItem('cart_id') || '';
      const data = await api.patch<Cart>(`/cart/items/${itemId}?cartId=${cartId}`, { quantity });
      setCart(data);
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setIsLoading(true);
    try {
      const cartId = localStorage.getItem('cart_id') || '';
      const data = await api.delete<Cart>(`/cart/items/${itemId}?cartId=${cartId}`);
      setCart(data);
    } finally {
      setIsLoading(false);
    }
  };

  const applyCoupon = async (code: string) => {
    setIsLoading(true);
    try {
      const data = await api.post<Cart>('/cart/coupon', { code });
      setCart(data);
    } finally {
      setIsLoading(false);
    }
  };

  const removeCoupon = async () => {
    setIsLoading(true);
    try {
      const data = await api.delete<Cart>('/cart/coupon');
      setCart(data);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = async () => {
    setIsLoading(true);
    try {
      await api.delete('/cart');
      setCart(emptyCart);
    } finally {
      setIsLoading(false);
    }
  };

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const value: CartContextValue = {
    cart,
    isLoading,
    itemCount,
    addItem,
    updateItem,
    removeItem,
    applyCoupon,
    removeCoupon,
    clearCart,
    refreshCart: fetchCart,
  };

  return createElement(CartContext.Provider, { value }, children);
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

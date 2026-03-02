"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Heart,
  Search,
  User,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Package,
  Settings,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '@/lib/authContext';
import { useCart } from '@/lib/cart';
import { cn } from '@/lib/utils';

const categories = [
  { label: 'Ropa', href: '/productos?categoria=ropa' },
  { label: 'Calzado', href: '/productos?categoria=calzado' },
  { label: 'Accesorios', href: '/productos?categoria=accesorios' },
  { label: 'Electronicos', href: '/productos?categoria=electronicos' },
  { label: 'Hogar', href: '/productos?categoria=hogar' },
];

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/buscar?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-neutral-200 shadow-xs">
      <div className="container-page">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0 text-xl font-bold text-brand-600 no-underline">
            Ecommerce
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors focus:outline-none">
                  Categorias <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[200px] rounded-lg border border-neutral-200 bg-white p-2 shadow-lg animate-slide-down"
                  sideOffset={8}
                >
                  {categories.map((cat) => (
                    <DropdownMenu.Item key={cat.href} asChild>
                      <Link
                        href={cat.href}
                        className="block rounded px-3 py-2 text-sm text-neutral-700 hover:bg-brand-50 hover:text-brand-700 no-underline outline-none"
                      >
                        {cat.label}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Link href="/productos" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 no-underline">
              Todos los productos
            </Link>
          </nav>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full rounded-full border border-neutral-300 bg-neutral-50 py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/wishlist"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 no-underline transition-colors"
            >
              <Heart className="h-5 w-5" />
            </Link>

            <Link
              href="/carrito"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 no-underline transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            {isAuthenticated ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold hover:bg-brand-200 focus:outline-none transition-colors">
                    {user?.firstName.charAt(0)}{user?.lastName.charAt(0)}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 min-w-[180px] rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
                    sideOffset={8}
                    align="end"
                  >
                    <div className="px-3 py-2 border-b border-neutral-100 mb-1">
                      <p className="text-sm font-semibold text-neutral-900">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-neutral-500">{user?.email}</p>
                    </div>
                    <DropdownMenu.Item asChild>
                      <Link href="/cuenta" className="flex items-center gap-2 rounded px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 no-underline outline-none">
                        <User className="h-4 w-4" /> Mi cuenta
                      </Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild>
                      <Link href="/cuenta/pedidos" className="flex items-center gap-2 rounded px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 no-underline outline-none">
                        <Package className="h-4 w-4" /> Mis pedidos
                      </Link>
                    </DropdownMenu.Item>
                    {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                      <DropdownMenu.Item asChild>
                        <Link href="/admin" className="flex items-center gap-2 rounded px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 no-underline outline-none">
                          <Settings className="h-4 w-4" /> Administración
                        </Link>
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Separator className="my-1 h-px bg-neutral-100" />
                    <DropdownMenu.Item
                      onSelect={handleLogout}
                      className="flex items-center gap-2 rounded px-3 py-2 text-sm text-error-600 hover:bg-error-50 cursor-pointer outline-none"
                    >
                      <LogOut className="h-4 w-4" /> Cerrar sesion
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex h-9 items-center rounded px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 no-underline transition-colors"
              >
                Entrar
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-neutral-100 py-4">
            <form onSubmit={handleSearch} className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos..."
                  className="w-full rounded-full border border-neutral-300 bg-neutral-50 py-2 pl-10 pr-4 text-sm focus:outline-none"
                />
              </div>
            </form>
            <nav className="space-y-1">
              {categories.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded no-underline"
                >
                  {cat.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <Link href="/login" className="block px-3 py-2 text-sm font-medium text-brand-600 no-underline">
                  Entrar / Registrarse
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

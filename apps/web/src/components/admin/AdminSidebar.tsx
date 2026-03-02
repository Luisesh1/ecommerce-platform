"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  FolderTree,
  Warehouse,
  ShoppingCart,
  Users,
  Tag,
  CreditCard,
  Truck,
  Receipt,
  ToggleLeft,
  HeartPulse,
  ClipboardList,
  MessageSquare,
  BarChart2,
  Database,
  Upload,
  Shield,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Productos', href: '/admin/productos', icon: ShoppingBag },
  { label: 'Categorias', href: '/admin/categorias', icon: FolderTree },
  { label: 'Inventario', href: '/admin/inventario', icon: Warehouse },
  { label: 'Pedidos', href: '/admin/pedidos', icon: ShoppingCart },
  { label: 'Clientes', href: '/admin/clientes', icon: Users },
  { label: 'Promociones', href: '/admin/promos', icon: Tag },
  { label: 'Pasarelas', href: '/admin/pasarelas', icon: CreditCard },
  { label: 'Envios', href: '/admin/envios', icon: Truck },
  { label: 'Impuestos', href: '/admin/impuestos', icon: Receipt },
  { label: 'Features', href: '/admin/features', icon: ToggleLeft },
  { label: 'Salud', href: '/admin/salud', icon: HeartPulse },
  { label: 'Auditoria', href: '/admin/auditoria', icon: ClipboardList },
  { label: 'Soporte', href: '/admin/soporte', icon: MessageSquare },
  { label: 'Tracking', href: '/admin/tracking', icon: BarChart2 },
  { label: 'Backups', href: '/admin/backups', icon: Database },
  { label: 'Importar', href: '/admin/importar', icon: Upload },
  { label: 'Fraude', href: '/admin/fraude', icon: Shield },
  { label: 'Ajustes', href: '/admin/settings', icon: Settings },
];

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen = true, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-64 flex-col bg-neutral-900 transition-transform duration-300 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-neutral-800">
          <Link href="/admin" className="text-lg font-bold text-white no-underline">
            Ecommerce Admin
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors no-underline',
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {item.badge !== undefined && (
                      <span className="ml-auto rounded-full bg-error-500 px-1.5 py-0.5 text-xs text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-neutral-800 px-4 py-3">
          <Link
            href="/"
            className="text-xs text-neutral-500 hover:text-neutral-300 no-underline"
          >
            Ir a la tienda
          </Link>
        </div>
      </aside>
    </>
  );
}

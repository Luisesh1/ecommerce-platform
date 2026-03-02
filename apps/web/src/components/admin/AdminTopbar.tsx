"use client";
import { Menu, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

interface AdminTopbarProps {
  onToggleSidebar?: () => void;
  title?: string;
}

export function AdminTopbar({ onToggleSidebar, title }: AdminTopbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        {title && (
          <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error-500" />
        </button>

        {/* User dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-100 focus:outline-none">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
              <span className="hidden md:block font-medium text-neutral-700">
                {user?.firstName} {user?.lastName}
              </span>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[180px] rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
              align="end"
              sideOffset={8}
            >
              <div className="px-3 py-2 border-b border-neutral-100 mb-1">
                <p className="text-xs text-neutral-500">{user?.email}</p>
                <p className="text-xs font-medium text-neutral-700 capitalize">
                  {user?.role?.toLowerCase().replace('_', ' ')}
                </p>
              </div>
              <DropdownMenu.Item asChild>
                <Link
                  href="/cuenta"
                  className="flex items-center gap-2 rounded px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 no-underline outline-none"
                >
                  <User className="h-4 w-4" /> Mi perfil
                </Link>
              </DropdownMenu.Item>
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
      </div>
    </header>
  );
}

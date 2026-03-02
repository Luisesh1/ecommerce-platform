"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, MapPin, User, Mail, Phone, Check } from 'lucide-react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/authContext';

import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Address {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface AddressFormData {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(2, 'Nombre requerido'),
  lastName: z.string().min(2, 'Apellido requerido'),
  email: z.string().email('Email invalido'),
  phone: z.string().optional(),
});

const addressSchema = z.object({
  firstName: z.string().min(2, 'Nombre requerido'),
  lastName: z.string().min(2, 'Apellido requerido'),
  address: z.string().min(5, 'Direccion requerida'),
  city: z.string().min(2, 'Ciudad requerida'),
  postalCode: z.string().min(4, 'Codigo postal invalido'),
  country: z.string().min(2, 'Pais requerido'),
  phone: z.string().optional(),
});

// ─── Shared input class ───────────────────────────────────────────────────────

const inputClass =
  'w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors';

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      {children}
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}

// ─── Profile tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: ((user as unknown) as Record<string, unknown>)?.phone as string || '',
    },
  });

  // Reset form when user loads
  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: ((user as unknown) as Record<string, unknown>)?.phone as string || '',
      });
    }
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: (data: ProfileFormData) => api.patch('/users/me', data),
    onSuccess: async () => {
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6 max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Nombre" error={errors.firstName?.message}>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input {...register('firstName')} className={`${inputClass} pl-9`} placeholder="Juan" />
          </div>
        </FormField>
        <FormField label="Apellido" error={errors.lastName?.message}>
          <input {...register('lastName')} className={inputClass} placeholder="Perez" />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input {...register('email')} type="email" className={`${inputClass} pl-9`} placeholder="juan@ejemplo.com" />
          </div>
        </FormField>
        <FormField label="Telefono" error={errors.phone?.message}>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input {...register('phone')} type="tel" className={`${inputClass} pl-9`} placeholder="+52 55 0000 0000" />
          </div>
        </FormField>
      </div>

      {mutation.isError && (
        <p className="text-sm text-error-600">Ocurrio un error al guardar los cambios.</p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!isDirty && !mutation.isPending}
          leftIcon={saved ? <Check className="h-4 w-4" /> : undefined}
        >
          {saved ? 'Guardado!' : 'Guardar cambios'}
        </Button>
        {isDirty && (
          <Button variant="ghost" type="button" onClick={() => reset()}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

// ─── Address form ─────────────────────────────────────────────────────────────

function AddressForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressFormData>({ resolver: zodResolver(addressSchema) });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: AddressFormData) => api.post('/users/me/addresses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      onSuccess();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      className="rounded-xl border-2 border-brand-200 bg-brand-50/30 p-5 space-y-4"
    >
      <h4 className="font-semibold text-neutral-900">Nueva direccion</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Nombre" error={errors.firstName?.message}>
          <input {...register('firstName')} className={inputClass} placeholder="Juan" />
        </FormField>
        <FormField label="Apellido" error={errors.lastName?.message}>
          <input {...register('lastName')} className={inputClass} placeholder="Perez" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Calle y numero" error={errors.address?.message}>
            <input {...register('address')} className={inputClass} placeholder="Av. Insurgentes 123, Col. Roma" />
          </FormField>
        </div>
        <FormField label="Ciudad" error={errors.city?.message}>
          <input {...register('city')} className={inputClass} placeholder="Ciudad de Mexico" />
        </FormField>
        <FormField label="Codigo postal" error={errors.postalCode?.message}>
          <input {...register('postalCode')} className={inputClass} placeholder="06600" />
        </FormField>
        <FormField label="Pais" error={errors.country?.message}>
          <select {...register('country')} className={inputClass}>
            <option value="">Selecciona...</option>
            <option value="MX">Mexico</option>
            <option value="US">Estados Unidos</option>
            <option value="CA">Canada</option>
            <option value="ES">Espana</option>
            <option value="AR">Argentina</option>
            <option value="CO">Colombia</option>
            <option value="CL">Chile</option>
          </select>
        </FormField>
        <FormField label="Telefono (opcional)">
          <input {...register('phone')} type="tel" className={inputClass} placeholder="+52 55 0000 0000" />
        </FormField>
      </div>
      {mutation.isError && (
        <p className="text-sm text-error-600">No se pudo guardar la direccion. Intenta de nuevo.</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending} size="sm">
          Guardar direccion
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ─── Addresses tab ────────────────────────────────────────────────────────────

function AddressesTab() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<{ data: Address[] }>('/users/me/addresses'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/me/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const addresses = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          <MapPin className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-700">No tienes direcciones guardadas</p>
          <p className="text-xs text-neutral-400 mt-1">Agrega una para agilizar tus compras</p>
        </div>
      )}

      {addresses.map((addr) => (
        <div
          key={addr.id}
          className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${
            addr.isDefault ? 'border-brand-300 bg-brand-50' : 'border-neutral-200 bg-white'
          }`}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-neutral-900">
                {addr.firstName} {addr.lastName}
              </p>
              {addr.isDefault && (
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                  Predeterminada
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-600">{addr.address}</p>
            <p className="text-sm text-neutral-600">
              {addr.city}, CP {addr.postalCode}, {addr.country}
            </p>
            {addr.phone && <p className="text-xs text-neutral-400">{addr.phone}</p>}
          </div>
          <button
            onClick={() => deleteMutation.mutate(addr.id)}
            disabled={deleteMutation.isPending}
            className="text-neutral-300 hover:text-error-500 transition-colors shrink-0 mt-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {showForm ? (
        <AddressForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      ) : (
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowForm(true)}
        >
          Agregar direccion
        </Button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/cuenta');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-6 max-w-3xl">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-80" />
        <div className="space-y-4 mt-4">
          <Skeleton className="h-10 w-full rounded" />
          <Skeleton className="h-10 w-full rounded" />
          <Skeleton className="h-10 w-full rounded" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="container-page py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">Mi cuenta</h1>
        {user && (
          <p className="text-neutral-500 mt-1">
            Bienvenido, <span className="font-medium text-neutral-800">{user.firstName} {user.lastName}</span>
          </p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Mis pedidos', href: '/cuenta/pedidos', icon: '📦' },
          { label: 'Lista de deseos', href: '/wishlist', icon: '❤️' },
          { label: 'Cerrar sesion', href: '/logout', icon: '🚪' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm font-medium text-neutral-700 hover:border-brand-300 hover:bg-brand-50 transition-colors no-underline"
          >
            <span>{link.icon}</span>
            {link.label}
          </a>
        ))}
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <Tabs
          tabs={[
            {
              value: 'perfil',
              label: 'Perfil',
              content: <ProfileTab />,
            },
            {
              value: 'direcciones',
              label: 'Direcciones',
              content: <AddressesTab />,
            },
          ]}
        />
      </div>
    </div>
  );
}

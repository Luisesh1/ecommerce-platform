"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

const promoSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y']),
  value: z.coerce.number().min(0).optional(),
  freeShipping: z.boolean(),
  minOrder: z.coerce.number().min(0).optional().nullable(),
  maxUses: z.coerce.number().int().min(1).optional().nullable(),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  combinable: z.boolean(),
});

type PromoFormValues = z.infer<typeof promoSchema>;

interface Promo extends PromoFormValues {
  id: string;
  usageCount: number;
  status: string;
}

const typeOptions = [
  { value: 'PERCENTAGE', label: 'Porcentaje (%)' },
  { value: 'FIXED_AMOUNT', label: 'Monto fijo ($)' },
  { value: 'FREE_SHIPPING', label: 'Envío gratis' },
  { value: 'BUY_X_GET_Y', label: 'Compra X lleva Y' },
];

function toDateInputValue(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function PromoEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const { data: promo, isLoading } = useQuery<Promo>({
    queryKey: ['admin-promo', id],
    queryFn: () => api.get<Promo>(`/admin/promos/${id}`),
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<PromoFormValues>({
    resolver: zodResolver(promoSchema),
    defaultValues: {
      code: '',
      type: 'PERCENTAGE',
      value: 0,
      freeShipping: false,
      minOrder: null,
      maxUses: null,
      startsAt: null,
      expiresAt: null,
      combinable: false,
    },
  });

  useEffect(() => {
    if (promo) {
      reset({
        code: promo.code,
        type: promo.type,
        value: promo.value,
        freeShipping: promo.freeShipping,
        minOrder: promo.minOrder,
        maxUses: promo.maxUses,
        startsAt: toDateInputValue(promo.startsAt as string),
        expiresAt: toDateInputValue(promo.expiresAt as string),
        combinable: promo.combinable,
      });
    }
  }, [promo, reset]);

  const updateMutation = useMutation({
    mutationFn: (values: PromoFormValues) =>
      api.patch(`/admin/promos/${id}`, values),
    onSuccess: () => {
      success('Promo actualizada');
      queryClient.invalidateQueries({ queryKey: ['admin-promos'] });
      queryClient.invalidateQueries({ queryKey: ['admin-promo', id] });
    },
    onError: () => toastError('Error al guardar'),
  });

  const watchedType = watch('type');

  const onSubmit = (values: PromoFormValues) => {
    updateMutation.mutate({
      ...values,
      code: values.code.toUpperCase(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Editar Promo</h1>
          {promo && (
            <p className="text-sm text-neutral-500 font-mono">{promo.code}</p>
          )}
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Código"
            error={errors.code?.message}
            {...register('code')}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
              register('code').onChange(e);
            }}
            placeholder="DESCUENTO20"
          />

          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select
                label="Tipo"
                options={typeOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          {watchedType !== 'FREE_SHIPPING' && (
            <Input
              label={
                watchedType === 'PERCENTAGE'
                  ? 'Valor (%)'
                  : watchedType === 'BUY_X_GET_Y'
                  ? 'Cantidad X'
                  : 'Valor ($)'
              }
              type="number"
              step={watchedType === 'PERCENTAGE' ? '0.1' : '0.01'}
              min="0"
              error={errors.value?.message}
              {...register('value')}
              suffix={
                watchedType === 'PERCENTAGE' ? (
                  <span className="text-neutral-500">%</span>
                ) : watchedType === 'FIXED_AMOUNT' ? (
                  <span className="text-neutral-500">$</span>
                ) : undefined
              }
            />
          )}

          <div className="flex items-center gap-3">
            <input
              id="freeShipping"
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              {...register('freeShipping')}
            />
            <label htmlFor="freeShipping" className="text-sm font-medium text-neutral-700">
              Incluir envío gratis
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Mínimo de orden ($)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              error={errors.minOrder?.message}
              {...register('minOrder')}
            />
            <Input
              label="Máximo de usos"
              type="number"
              step="1"
              min="1"
              placeholder="Sin límite"
              error={errors.maxUses?.message}
              {...register('maxUses')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha inicio"
              type="date"
              error={errors.startsAt?.message}
              {...register('startsAt')}
            />
            <Input
              label="Fecha fin"
              type="date"
              error={errors.expiresAt?.message}
              {...register('expiresAt')}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="combinable"
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              {...register('combinable')}
            />
            <label htmlFor="combinable" className="text-sm font-medium text-neutral-700">
              Combinable con otros descuentos
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              loading={updateMutation.isPending}
              disabled={!isDirty}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>

      {promo && (
        <Card className="p-4">
          <p className="text-xs text-neutral-500">
            Usos actuales: <strong>{promo.usageCount}</strong> · Estado:{' '}
            <strong>{promo.status}</strong>
          </p>
        </Card>
      )}
    </div>
  );
}

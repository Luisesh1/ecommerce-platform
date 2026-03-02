"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/useToast';

// ---- Schema ----

const variantSchema = z.object({
  attribute: z.string().min(1),
  value: z.string().min(1),
  sku: z.string().min(1),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
});

const imageSchema = z.object({
  url: z.string().url('URL inválida'),
  alt: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  slug: z.string().min(1, 'Slug requerido'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Precio debe ser >= 0'),
  compareAtPrice: z.coerce.number().optional(),
  categoryId: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  variants: z.array(variantSchema).default([]),
  images: z.array(imageSchema).default([]),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

// ---- Helpers ----

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---- Component ----

export default function NuevoProductoPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { data: categories = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['categories-select'],
    queryFn: () => api.get('/categories'),
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      status: 'DRAFT',
      variants: [],
      images: [],
    },
  });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
  } = useFieldArray({ control, name: 'variants' });

  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
  } = useFieldArray({ control, name: 'images' });

  const createProduct = useMutation({
    mutationFn: (data: ProductForm) =>
      api.post<{ id: string }>('/products', {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        price: Math.round(data.price * 100),
        compareAtPrice: data.compareAtPrice ? Math.round(data.compareAtPrice * 100) : undefined,
        variants: data.variants.map((v) => ({
          ...v,
          price: Math.round(v.price * 100),
        })),
      }),
    onSuccess: (product: { id: string }) => {
      toast({ title: 'Producto creado', variant: 'success' });
      router.push(`/admin/productos/${product.id}`);
    },
    onError: () => toast({ title: 'Error al crear producto', variant: 'error' }),
  });

  const nameValue = watch('name');

  const STATUS_OPTIONS = [
    { value: 'DRAFT', label: 'Borrador' },
    { value: 'ACTIVE', label: 'Activo' },
    { value: 'ARCHIVED', label: 'Archivado' },
  ];

  const categoryOptions = [
    { value: '', label: 'Sin categoría' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const tabs = [
    {
      value: 'general',
      label: 'General',
      content: (
        <div className="space-y-4 max-w-xl">
          <Input
            label="Nombre"
            {...register('name')}
            error={errors.name?.message}
            required
            onChange={(e) => {
              setValue('name', e.target.value);
              setValue('slug', slugify(e.target.value));
            }}
          />
          <Input
            label="Slug"
            {...register('slug')}
            error={errors.slug?.message}
            hint="Identificador en URL"
            required
          />
          <Input
            label="Descripción"
            {...register('description')}
            hint="Descripción visible del producto"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio (MXN)"
              type="number"
              step="0.01"
              {...register('price')}
              error={errors.price?.message}
              required
              prefix={<span className="text-sm">$</span>}
            />
            <Input
              label="Precio comparación"
              type="number"
              step="0.01"
              {...register('compareAtPrice')}
              hint="Tachado"
              prefix={<span className="text-sm">$</span>}
            />
          </div>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <Select
                label="Categoría"
                options={categoryOptions}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            )}
          />
          <Input
            label="Tags"
            {...register('tags')}
            placeholder="ropa, verano, oferta"
            hint="Separados por coma"
          />
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                label="Estado"
                options={STATUS_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      ),
    },
    {
      value: 'variants',
      label: 'Variantes',
      content: (
        <div className="space-y-4">
          {variantFields.length === 0 && (
            <p className="text-sm text-neutral-500">
              Sin variantes. El producto se vende como unidad única.
            </p>
          )}
          {variantFields.map((field, i) => (
            <div key={field.id} className="p-4 border border-neutral-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-700">
                  Variante {i + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVariant(i)}
                >
                  <Trash2 className="h-4 w-4 text-error-500" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Atributo"
                  {...register(`variants.${i}.attribute`)}
                  placeholder="Color"
                />
                <Input
                  label="Valor"
                  {...register(`variants.${i}.value`)}
                  placeholder="Rojo"
                />
                <Input
                  label="SKU"
                  {...register(`variants.${i}.sku`)}
                  required
                />
                <Input
                  label="Precio"
                  type="number"
                  step="0.01"
                  {...register(`variants.${i}.price`)}
                  prefix={<span className="text-sm">$</span>}
                />
                <Input
                  label="Stock"
                  type="number"
                  {...register(`variants.${i}.stock`)}
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() =>
              appendVariant({ attribute: '', value: '', sku: '', price: 0, stock: 0 })
            }
          >
            Añadir variante
          </Button>
        </div>
      ),
    },
    {
      value: 'images',
      label: 'Imágenes',
      content: (
        <div className="space-y-4">
          {imageFields.map((field, i) => (
            <div key={field.id} className="flex items-end gap-3">
              <div className="flex-1 space-y-3">
                <Input
                  label={`URL imagen ${i + 1}`}
                  {...register(`images.${i}.url`)}
                  error={errors.images?.[i]?.url?.message}
                  placeholder="https://..."
                />
                <Input
                  label="Alt text"
                  {...register(`images.${i}.alt`)}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mb-1"
                onClick={() => removeImage(i)}
              >
                <Trash2 className="h-4 w-4 text-error-500" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => appendImage({ url: '', alt: '' })}
          >
            Añadir imagen
          </Button>
        </div>
      ),
    },
    {
      value: 'seo',
      label: 'SEO',
      content: (
        <div className="space-y-4 max-w-xl">
          <Input
            label="Meta título"
            {...register('metaTitle')}
            hint="Título en resultados de búsqueda"
          />
          <Input
            label="Meta descripción"
            {...register('metaDescription')}
            hint="Descripción en resultados de búsqueda"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Nuevo producto</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {nameValue ? `"${nameValue}"` : 'Sin nombre'}
          </p>
        </div>
        <div className="ml-auto">
          <Button
            onClick={handleSubmit((data) => createProduct.mutate(data))}
            loading={createProduct.isPending}
          >
            Crear producto
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <Tabs tabs={tabs} defaultValue="general" />
      </div>
    </div>
  );
}

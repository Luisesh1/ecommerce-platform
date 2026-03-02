"use client";
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';

// ---- Types ----
interface Category {
  id: string;
  name: string;
}

interface ProductVariant {
  id?: string;
  attribute: string;
  value: string;
  sku: string;
  price: number;
  stock: number;
}

interface ProductImage {
  id?: string;
  url: string;
  alt: string;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  categoryId: string;
  tags: string[];
  status: string;
  variants: ProductVariant[];
  images: ProductImage[];
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
}

// ---- Schema ----
const productSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  slug: z.string().min(1, 'Slug requerido'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Precio debe ser positivo'),
  compareAtPrice: z.coerce.number().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  variants: z.array(
    z.object({
      id: z.string().optional(),
      attribute: z.string(),
      value: z.string(),
      sku: z.string(),
      price: z.coerce.number().min(0),
      stock: z.coerce.number().min(0),
    })
  ).default([]),
  images: z.array(
    z.object({
      id: z.string().optional(),
      url: z.string(),
      alt: z.string(),
    })
  ).default([]),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

// ---- Helpers ----
function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'ARCHIVED', label: 'Archivado' },
];

const ADJUST_REASON_OPTIONS = [
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'ADJUSTMENT', label: 'Ajuste manual' },
  { value: 'DAMAGE', label: 'Daño / Pérdida' },
  { value: 'RETURN', label: 'Devolución' },
];

// ---- Component ----
export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('general');
  const [tagInput, setTagInput] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [stockModal, setStockModal] = useState<{ variantId: string; variantName: string } | null>(null);
  const [stockAdjust, setStockAdjust] = useState({ quantity: 0, reason: 'ADJUSTMENT' });
  const [movementsModal, setMovementsModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['admin-product', id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: !!id,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });

  const { data: movements, isLoading: loadingMovements } = useQuery<StockMovement[]>({
    queryKey: ['admin-inventory-movements', movementsModal],
    queryFn: () => api.get<StockMovement[]>(`/inventory/${movementsModal}/movements`),
    enabled: !!movementsModal,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      price: 0,
      status: 'DRAFT',
      tags: [],
      variants: [],
      images: [],
    },
  });

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: 'variants',
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control,
    name: 'images',
  });

  const watchedName = watch('name');
  const watchedTags = watch('tags');

  useEffect(() => {
    if (product) {
      setValue('name', product.name);
      setValue('slug', product.slug);
      setValue('description', product.description ?? '');
      setValue('price', product.price);
      setValue('compareAtPrice', product.compareAtPrice);
      setValue('categoryId', product.categoryId ?? '');
      setValue('tags', product.tags ?? []);
      setValue('status', product.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED');
      setValue('variants', product.variants ?? []);
      setValue('images', product.images ?? []);
      setValue('metaTitle', product.metaTitle ?? '');
      setValue('metaDescription', product.metaDescription ?? '');
      setValue('ogTitle', product.ogTitle ?? '');
      setValue('ogDescription', product.ogDescription ?? '');
    }
  }, [product, setValue]);

  const saveMutation = useMutation({
    mutationFn: (data: ProductFormData) => api.patch(`/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
      setToast({ type: 'success', message: 'Producto actualizado correctamente' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: () => {
      setToast({ type: 'error', message: 'Error al guardar el producto' });
      setTimeout(() => setToast(null), 3000);
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: () =>
      api.post('/inventory/adjust', {
        variantId: stockModal?.variantId,
        quantity: stockAdjust.quantity,
        reason: stockAdjust.reason,
      }),
    onSuccess: () => {
      setStockModal(null);
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
      setToast({ type: 'success', message: 'Stock ajustado correctamente' });
      setTimeout(() => setToast(null), 3000);
    },
  });

  const categoryOptions = [
    { value: '', label: 'Sin categoría' },
    ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleNameBlur = () => {
    const current = watch('slug');
    if (!current || current === slugify(product?.name ?? '')) {
      setValue('slug', slugify(watchedName));
    }
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag && !watchedTags.includes(tag)) {
        setValue('tags', [...watchedTags, tag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setValue('tags', watchedTags.filter((t) => t !== tag));
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      appendImage({ url, alt: file.name });
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      appendImage({ url, alt: file.name });
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{product?.name ?? 'Producto'}</h1>
            <p className="text-sm text-neutral-500">Editar producto</p>
          </div>
        </div>
        <Button
          leftIcon={<Save className="h-4 w-4" />}
          onClick={handleSubmit((data) => saveMutation.mutate(data))}
          loading={saveMutation.isPending}
          disabled={!isDirty}
        >
          Guardar cambios
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-success-50 text-success-700 border border-success-200'
              : 'bg-error-50 text-error-700 border border-error-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'general', label: 'General' },
          { id: 'variantes', label: 'Variantes' },
          { id: 'imagenes', label: 'Imágenes' },
          { id: 'seo', label: 'SEO' },
          { id: 'inventario', label: 'Inventario' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-5 max-w-2xl">
            <Input
              label="Nombre"
              {...register('name')}
              error={errors.name?.message}
              onBlur={handleNameBlur}
              required
            />
            <Input
              label="Slug"
              {...register('slug')}
              error={errors.slug?.message}
              hint="URL amigable del producto"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Descripción</label>
              <textarea
                {...register('description')}
                rows={5}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="Descripción del producto..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Precio"
                type="number"
                step="0.01"
                {...register('price')}
                error={errors.price?.message}
                required
              />
              <Input
                label="Precio comparativo"
                type="number"
                step="0.01"
                {...register('compareAtPrice')}
                hint="Precio tachado original"
              />
            </div>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  label="Categoría"
                  options={categoryOptions}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Etiquetas</label>
              <div className="flex flex-wrap gap-2 rounded border border-neutral-300 px-3 py-2 min-h-[42px] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                {watchedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-brand-900">
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                  placeholder="Agregar etiqueta..."
                  className="flex-1 min-w-[120px] bg-transparent text-sm focus:outline-none placeholder:text-neutral-400"
                />
              </div>
              <p className="text-xs text-neutral-500">Presiona Enter o coma para agregar</p>
            </div>
            <Controller
              control={control}
              name="status"
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
        )}

        {/* Variantes Tab */}
        {activeTab === 'variantes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900">Variantes del producto</h2>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => appendVariant({ attribute: '', value: '', sku: '', price: 0, stock: 0 })}
              >
                Agregar variante
              </Button>
            </div>
            {variantFields.length === 0 ? (
              <p className="text-sm text-neutral-400 py-8 text-center">Sin variantes. Agrega una para empezar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="pb-2 text-left text-xs font-medium text-neutral-500">Atributo</th>
                      <th className="pb-2 text-left text-xs font-medium text-neutral-500">Valor</th>
                      <th className="pb-2 text-left text-xs font-medium text-neutral-500">SKU</th>
                      <th className="pb-2 text-left text-xs font-medium text-neutral-500">Precio</th>
                      <th className="pb-2 text-left text-xs font-medium text-neutral-500">Stock</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {variantFields.map((field, index) => (
                      <tr key={field.id}>
                        <td className="py-2 pr-2">
                          <input
                            {...register(`variants.${index}.attribute`)}
                            placeholder="ej. Color"
                            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            {...register(`variants.${index}.value`)}
                            placeholder="ej. Rojo"
                            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            {...register(`variants.${index}.sku`)}
                            placeholder="SKU-001"
                            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-mono focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            {...register(`variants.${index}.price`)}
                            className="w-24 rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            {...register(`variants.${index}.stock`)}
                            className="w-20 rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="text-neutral-400 hover:text-error-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Imágenes Tab */}
        {activeTab === 'imagenes' && (
          <div className="space-y-4">
            {/* Drag & Drop */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 p-10 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
            >
              <p className="text-sm font-medium text-neutral-600">Arrastra imágenes aquí o haz clic para seleccionar</p>
              <p className="text-xs text-neutral-400 mt-1">PNG, JPG, WebP hasta 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {/* Images Grid */}
            {imageFields.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {imageFields.map((field, index) => (
                  <div key={field.id} className="relative group">
                    <img
                      src={watch(`images.${index}.url`)}
                      alt={watch(`images.${index}.alt`)}
                      className="aspect-square w-full rounded-lg object-cover border border-neutral-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-error-500 text-white"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <input
                      {...register(`images.${index}.alt`)}
                      placeholder="Texto alternativo"
                      className="mt-1.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEO Tab */}
        {activeTab === 'seo' && (
          <div className="space-y-5 max-w-2xl">
            <Input label="Meta título" {...register('metaTitle')} hint="Recomendado: 50-60 caracteres" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Meta descripción</label>
              <textarea
                {...register('metaDescription')}
                rows={3}
                placeholder="Descripción para buscadores..."
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <p className="text-xs text-neutral-500">Recomendado: 150-160 caracteres</p>
            </div>
            <Input label="OG título" {...register('ogTitle')} hint="Para redes sociales (Open Graph)" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">OG descripción</label>
              <textarea
                {...register('ogDescription')}
                rows={3}
                placeholder="Descripción para redes sociales..."
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
        )}

        {/* Inventario Tab */}
        {activeTab === 'inventario' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-neutral-900">Stock por variante</h2>
            {(product?.variants ?? []).length === 0 ? (
              <p className="text-sm text-neutral-400 py-8 text-center">Sin variantes configuradas</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="pb-2 text-left text-xs font-medium text-neutral-500">Variante</th>
                    <th className="pb-2 text-left text-xs font-medium text-neutral-500">SKU</th>
                    <th className="pb-2 text-left text-xs font-medium text-neutral-500">Stock actual</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(product?.variants ?? []).map((v) => (
                    <tr key={v.id}>
                      <td className="py-3 font-medium">{v.attribute}: {v.value}</td>
                      <td className="py-3 font-mono text-xs text-neutral-500">{v.sku}</td>
                      <td className="py-3">
                        <span className={v.stock === 0 ? 'text-error-600 font-bold' : v.stock < 5 ? 'text-warning-600 font-semibold' : 'text-neutral-700'}>
                          {v.stock}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMovementsModal(v.id ?? '')}
                          >
                            Ver historial
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStockModal({ variantId: v.id ?? '', variantName: `${v.attribute}: ${v.value}` })}
                          >
                            Ajustar Stock
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      <Modal
        open={!!stockModal}
        onClose={() => setStockModal(null)}
        title="Ajustar Stock"
        description={stockModal?.variantName}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStockModal(null)}>Cancelar</Button>
            <Button onClick={() => adjustStockMutation.mutate()} loading={adjustStockMutation.isPending}>
              Guardar ajuste
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Cantidad</label>
            <input
              type="number"
              value={stockAdjust.quantity}
              onChange={(e) => setStockAdjust((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
              className="h-10 w-full rounded border border-neutral-300 px-3 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="Positivo para agregar, negativo para restar"
            />
            <p className="text-xs text-neutral-500">Use valores negativos para reducir el stock</p>
          </div>
          <Select
            label="Razón"
            options={ADJUST_REASON_OPTIONS}
            value={stockAdjust.reason}
            onChange={(v) => setStockAdjust((prev) => ({ ...prev, reason: v }))}
          />
        </div>
      </Modal>

      {/* Movements Modal */}
      <Modal
        open={!!movementsModal}
        onClose={() => setMovementsModal(null)}
        title="Historial de movimientos"
        size="lg"
      >
        {loadingMovements ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !movements || movements.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4 text-center">Sin movimientos registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="pb-2 text-left text-xs font-medium text-neutral-500">Tipo</th>
                <th className="pb-2 text-left text-xs font-medium text-neutral-500">Cantidad</th>
                <th className="pb-2 text-left text-xs font-medium text-neutral-500">Razón</th>
                <th className="pb-2 text-left text-xs font-medium text-neutral-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="py-2">
                    <Badge variant={m.quantity > 0 ? 'success' : 'error'} size="sm">{m.type}</Badge>
                  </td>
                  <td className={`py-2 font-semibold ${m.quantity > 0 ? 'text-success-600' : 'text-error-600'}`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </td>
                  <td className="py-2 text-neutral-600">{m.reason}</td>
                  <td className="py-2 text-neutral-400 text-xs">
                    {new Date(m.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}

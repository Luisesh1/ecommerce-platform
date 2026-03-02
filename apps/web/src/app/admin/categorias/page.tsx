"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/useToast';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  sortOrder: number;
  productsCount: number;
  children?: Category[];
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  parentId: string;
  sortOrder: string;
}

const EMPTY_FORM: CategoryFormData = {
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  parentId: '',
  sortOrder: '0',
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Build flat list of categories for parent selector
function flattenCategories(categories: Category[], depth = 0): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [];
  for (const cat of categories) {
    opts.push({ value: cat.id, label: `${'  '.repeat(depth)}${cat.name}` });
    if (cat.children?.length) {
      opts.push(...flattenCategories(cat.children, depth + 1));
    }
  }
  return opts;
}

interface CategoryNodeProps {
  category: Category;
  depth: number;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onAddChild: (parentId: string) => void;
}

function CategoryNode({ category, depth, onEdit, onDelete, onAddChild }: CategoryNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (category.children?.length ?? 0) > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-neutral-50 group"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <button
          className={`h-4 w-4 text-neutral-400 transition-transform ${hasChildren ? '' : 'invisible'} ${expanded ? 'rotate-90' : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          {category.imageUrl && (
            <img
              src={category.imageUrl}
              alt={category.name}
              className="h-7 w-7 rounded object-cover bg-neutral-100"
            />
          )}
          <div>
            <span className="font-medium text-neutral-900">{category.name}</span>
            <span className="ml-2 text-xs text-neutral-400 font-mono">/{category.slug}</span>
          </div>
          <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
            {category.productsCount} productos
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddChild(category.id)}
            title="Añadir subcategoría"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(category)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(category)}>
            <Trash2 className="h-3.5 w-3.5 text-error-500" />
          </Button>
        </div>
      </div>
      {hasChildren && expanded && (
        <div>
          {category.children!.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriasPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormData>(EMPTY_FORM);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });

  const parentOptions = [
    { value: '', label: 'Sin padre (raíz)' },
    ...flattenCategories(categories),
  ];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] });

  const saveCategory = useMutation({
    mutationFn: (data: Partial<CategoryFormData>) => {
      const payload = {
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        imageUrl: data.imageUrl || undefined,
        parentId: data.parentId || undefined,
        sortOrder: parseInt(data.sortOrder ?? '0', 10),
      };
      return editingCategory
        ? api.patch(`/categories/${editingCategory.id}`, payload)
        : api.post('/categories', payload);
    },
    onSuccess: () => {
      toast({ title: editingCategory ? 'Categoría actualizada' : 'Categoría creada', variant: 'success' });
      setShowModal(false);
      invalidate();
    },
    onError: () => toast({ title: 'Error al guardar categoría', variant: 'error' }),
  });

  const deleteCategory = useMutation({
    mutationFn: () => api.delete(`/categories/${deletingCategory!.id}`),
    onSuccess: () => {
      toast({ title: 'Categoría eliminada', variant: 'success' });
      setShowDeleteModal(false);
      invalidate();
    },
    onError: () => toast({ title: 'Error al eliminar categoría', variant: 'error' }),
  });

  const openCreate = (parentId = '') => {
    setEditingCategory(null);
    setForm({ ...EMPTY_FORM, parentId });
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? '',
      imageUrl: cat.imageUrl ?? '',
      parentId: cat.parentId ?? '',
      sortOrder: String(cat.sortOrder),
    });
    setShowModal(true);
  };

  const openDelete = (cat: Category) => {
    setDeletingCategory(cat);
    setShowDeleteModal(true);
  };

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: editingCategory ? f.slug : slugify(name),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Categorías</h1>
          <p className="text-sm text-neutral-500 mt-1">Árbol de categorías del catálogo</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => openCreate()}>
          Nueva categoría raíz
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <p>No hay categorías. Crea la primera.</p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-xl bg-white divide-y divide-neutral-100">
          {categories.map((cat) => (
            <CategoryNode
              key={cat.id}
              category={cat}
              depth={0}
              onEdit={openEdit}
              onDelete={openDelete}
              onAddChild={(parentId) => openCreate(parentId)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveCategory.mutate(form)}
              loading={saveCategory.isPending}
            >
              {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            hint="URL amigable, auto-generado desde el nombre"
            required
          />
          <Input
            label="Descripción"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Input
            label="URL de imagen"
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            placeholder="https://..."
          />
          <Select
            label="Categoría padre"
            options={parentOptions}
            value={form.parentId}
            onChange={(v) => setForm((f) => ({ ...f, parentId: v }))}
          />
          <Input
            label="Orden"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar categoría"
        description={`¿Eliminar "${deletingCategory?.name}"? Los productos asociados quedarán sin categoría.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteCategory.mutate()}
              loading={deleteCategory.isPending}
            >
              Eliminar
            </Button>
          </div>
        }
      >
        {(deletingCategory?.children?.length ?? 0) > 0 && (
          <p className="text-sm text-warning-600 bg-warning-50 p-3 rounded-lg">
            Esta categoría tiene subcategorías que también se verán afectadas.
          </p>
        )}
      </Modal>
    </div>
  );
}

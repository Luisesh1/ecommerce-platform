'use client';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  AlertTriangle,
  PackageX,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { KpiCard } from '@/components/admin/KpiCard';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';

// ---- Types ----
interface AdminStats {
  ventasHoy: number;
  pedidosHoy: number;
  clientesNuevos: number;
  tasaConversion: number;
  pedidosPendientes: number;
  ingresosMes: number;
  ingresosMesTrend?: number;
  pedidosHoyTrend?: number;
  clientesNuevosTrend?: number;
  tasaConversionTrend?: number;
}

interface SalesChartPoint {
  date: string;
  total: number;
}

interface Order {
  id: string;
  number: string;
  customerName: string;
  createdAt: string;
  status: string;
  total: number;
  paymentMethod: string;
}

interface OrdersResponse {
  data: Order[];
  total: number;
}

interface InventoryAlert {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  stock: number;
  minimum: number;
}

interface AlertsResponse {
  data: InventoryAlert[];
}

// ---- Helpers ----
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
};

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'error',
  REFUNDED: 'neutral',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// ---- Component ----
export default function AdminDashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
  });

  const { data: salesChart, isLoading: loadingChart } = useQuery<SalesChartPoint[]>({
    queryKey: ['admin-stats-sales-chart'],
    queryFn: () => api.get<SalesChartPoint[]>('/admin/stats/sales-chart'),
  });

  const { data: recentOrders, isLoading: loadingOrders } = useQuery<OrdersResponse>({
    queryKey: ['admin-orders-recent'],
    queryFn: () => api.get<OrdersResponse>('/orders', { limit: 10 }),
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery<AlertsResponse>({
    queryKey: ['admin-inventory-alerts'],
    queryFn: () => api.get<AlertsResponse>('/inventory/alerts', { limit: 5 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Resumen general del negocio</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Ingresos del mes"
          value={stats ? formatCurrency(stats.ingresosMes) : '—'}
          icon={DollarSign}
          iconColor="text-success-600"
          trend={stats?.ingresosMesTrend}
          trendLabel="vs mes anterior"
          isLoading={loadingStats}
        />
        <KpiCard
          title="Pedidos hoy"
          value={stats?.pedidosHoy ?? '—'}
          icon={ShoppingCart}
          iconColor="text-brand-600"
          trend={stats?.pedidosHoyTrend}
          trendLabel="vs ayer"
          isLoading={loadingStats}
        />
        <KpiCard
          title="Clientes nuevos"
          value={stats?.clientesNuevos ?? '—'}
          icon={Users}
          iconColor="text-purple-600"
          trend={stats?.clientesNuevosTrend}
          trendLabel="este mes"
          isLoading={loadingStats}
        />
        <KpiCard
          title="Tasa de conversión"
          value={stats ? `${stats.tasaConversion.toFixed(2)}%` : '—'}
          icon={TrendingUp}
          iconColor="text-warning-600"
          trend={stats?.tasaConversionTrend}
          trendLabel="vs mes anterior"
          isLoading={loadingStats}
        />
      </div>

      {/* Sales Chart */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-base font-semibold text-neutral-900 mb-4">Ventas últimos 30 días</h2>
        {loadingChart ? (
          <Skeleton className="h-64 w-full" />
        ) : !salesChart || salesChart.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-neutral-400 text-sm">
            Sin datos de ventas
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={salesChart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => new Date(v).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(val: number) => [formatCurrency(val), 'Ventas']}
                labelFormatter={(label) => formatDate(label)}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="xl:col-span-2 rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
            <h2 className="text-base font-semibold text-neutral-900">Pedidos recientes</h2>
            <a href="/admin/pedidos" className="text-sm text-brand-600 hover:underline">
              Ver todos
            </a>
          </div>
          {loadingOrders ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !recentOrders || recentOrders.data.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-neutral-400 text-sm">
              Sin pedidos recientes
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Pedido</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Estado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {recentOrders.data.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-3">
                        <a href={`/admin/pedidos/${order.id}`} className="font-medium text-brand-600 hover:underline">
                          #{order.number}
                        </a>
                      </td>
                      <td className="px-6 py-3 text-neutral-700">{order.customerName}</td>
                      <td className="px-6 py-3 text-neutral-500">{formatDate(order.createdAt)}</td>
                      <td className="px-6 py-3">
                        <Badge variant={STATUS_BADGE[order.status] ?? 'neutral'} size="sm">
                          {STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-neutral-900">
                        {formatCurrency(order.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
            <h2 className="text-base font-semibold text-neutral-900">Stock bajo</h2>
            <a href="/admin/inventario" className="text-sm text-brand-600 hover:underline">
              Ver inventario
            </a>
          </div>
          {loadingAlerts ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !alerts || alerts.data.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-neutral-400 text-sm">
              Sin alertas de stock
            </div>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {alerts.data.map((alert) => (
                <li key={alert.variantId} className="flex items-start gap-3 px-6 py-3">
                  <div className="mt-0.5">
                    {alert.stock === 0 ? (
                      <PackageX className="h-4 w-4 text-error-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning-500 shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900 truncate">{alert.productName}</p>
                    <p className="text-xs text-neutral-500 truncate">{alert.sku} · {alert.variantName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${alert.stock === 0 ? 'text-error-600' : 'text-warning-600'}`}>
                      {alert.stock}
                    </p>
                    <p className="text-xs text-neutral-400">/ min {alert.minimum}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

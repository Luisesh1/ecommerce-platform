import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
export class AdminStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getStats() {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      totalProducts, totalOrders, totalUsers,
      todayOrders, monthRevAgg, lastMonthRevAgg,
      newUsersThisMonth, newUsersLastMonth,
    ] = await Promise.all([
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.order.count(),
      this.prisma.user.count(),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { createdAt: { gte: monthStart }, status: { notIn: ['CANCELLED', 'FULLY_REFUNDED'] as any } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: { notIn: ['CANCELLED'] as any } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    ]);

    const ingresosMes = Number(monthRevAgg._sum.totalAmount || 0) / 100;
    const ingresosUltimoMes = Number(lastMonthRevAgg._sum.totalAmount || 0) / 100;
    const ingresosMesTrend = ingresosUltimoMes > 0
      ? Math.round(((ingresosMes - ingresosUltimoMes) / ingresosUltimoMes) * 100)
      : 0;
    const clientesNuevosTrend = newUsersLastMonth > 0
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : 0;

    return {
      // Legacy fields (frontend espera estos)
      ingresosMes,
      ingresosMesTrend,
      pedidosHoy: todayOrders,
      pedidosHoyTrend: 0,
      clientesNuevos: newUsersThisMonth,
      clientesNuevosTrend,
      tasaConversion: totalOrders > 0 ? Math.min((totalOrders / Math.max(totalUsers, 1)) * 100, 100) : 0,
      tasaConversionTrend: 0,
      // Extra fields
      totalProducts,
      totalOrders,
      totalUsers,
    };
  }

  @Get('sales-chart')
  async getSalesChart() {
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);

      const agg = await this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: true,
        where: { createdAt: { gte: date, lt: next }, status: { notIn: ['CANCELLED'] as any } },
      });

      result.push({
        date: date.toISOString().split('T')[0],
        revenue: Number(agg._sum.totalAmount || 0) / 100,
        orders: agg._count,
      });
    }
    return result;
  }
}

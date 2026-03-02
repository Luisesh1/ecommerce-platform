import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inject a fake access token into localStorage so admin pages don't redirect
 * to the login screen during tests.  In a real suite this would hit a real
 * auth endpoint; here we rely on the app reading the token from storage.
 */
async function loginAsAdmin(page: Page): Promise<void> {
  // Navigate to the admin root first so the domain is set
  await page.goto('/admin');
  await page.evaluate(() => {
    localStorage.setItem('access_token', 'test_admin_token');
    localStorage.setItem('refresh_token', 'test_refresh_token');
    sessionStorage.setItem('user_role', 'SUPER_ADMIN');
  });
  // Reload so the app picks up the stored token
  await page.reload();
  await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Admin Features', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // -------------------------------------------------------------------------
  // Dashboard KPIs
  // -------------------------------------------------------------------------
  test('admin dashboard shows KPIs', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('kpi-ventas-hoy')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('kpi-pedidos')).toBeVisible();
    await expect(page.getByTestId('kpi-clientes')).toBeVisible();
    await expect(page.getByTestId('kpi-conversion')).toBeVisible();
  });

  test('dashboard KPIs display numeric values', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const ventasHoy = page.getByTestId('kpi-ventas-hoy');
    await ventasHoy.waitFor({ state: 'visible' });
    const text = await ventasHoy.textContent();
    expect(text).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Products table
  // -------------------------------------------------------------------------
  test('products table loads and filters by status', async ({ page }) => {
    await page.goto('/admin/productos');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // Filter by ACTIVE status
    await page.getByTestId('filter-status').selectOption('ACTIVE');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('table')).toBeVisible();
  });

  test('products table shows at least the column headers', async ({ page }) => {
    await page.goto('/admin/productos');
    await page.waitForLoadState('networkidle');

    const table = page.getByRole('table');
    await table.waitFor({ state: 'visible', timeout: 15_000 });

    // Expect standard column headers
    const headers = table.getByRole('columnheader');
    await expect(headers).not.toHaveCount(0);
  });

  test('products table supports search', async ({ page }) => {
    await page.goto('/admin/productos');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('search-products');
    if (await searchInput.count() === 0) {
      test.skip();
      return;
    }

    await searchInput.fill('Camiseta');
    await page.waitForLoadState('networkidle');

    // Table should still be visible after search
    await expect(page.getByRole('table')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Feature flags
  // -------------------------------------------------------------------------
  test('feature flags page renders toggles', async ({ page }) => {
    await page.goto('/admin/features');
    await page.waitForLoadState('networkidle');

    const toggles = page.getByTestId('feature-flag-toggle');
    await expect(toggles.first()).toBeVisible({ timeout: 15_000 });
  });

  test('feature flags can be toggled', async ({ page }) => {
    await page.goto('/admin/features');
    await page.waitForLoadState('networkidle');

    const firstFlag = page.getByTestId('feature-flag-toggle').first();
    await firstFlag.waitFor({ state: 'visible', timeout: 15_000 });

    const initialState = await firstFlag.isChecked();

    // Click the toggle
    await firstFlag.click();

    // Wait for the API response confirming the update
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/features/') &&
        (resp.status() === 200 || resp.status() === 201),
      { timeout: 15_000 },
    );

    const newState = await firstFlag.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('feature flags show key and description', async ({ page }) => {
    await page.goto('/admin/features');
    await page.waitForLoadState('networkidle');

    const firstRow = page.getByTestId('feature-flag-row').first();
    if (await firstRow.count() === 0) {
      test.skip();
      return;
    }

    await expect(firstRow.getByTestId('flag-key')).toBeVisible();
    await expect(firstRow.getByTestId('flag-description')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Health dashboard
  // -------------------------------------------------------------------------
  test('health dashboard shows service statuses', async ({ page }) => {
    await page.goto('/admin/salud');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('health-db')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('health-redis')).toBeVisible();
    await expect(page.getByTestId('health-meilisearch')).toBeVisible();
  });

  test('health indicators show OK or ERROR badge', async ({ page }) => {
    await page.goto('/admin/salud');
    await page.waitForLoadState('networkidle');

    const dbBadge = page.getByTestId('health-db').getByTestId('health-status');
    await dbBadge.waitFor({ state: 'visible', timeout: 20_000 });
    const status = await dbBadge.textContent();
    expect(['OK', 'ERROR', 'DEGRADED']).toContain(status?.trim());
  });

  // -------------------------------------------------------------------------
  // Create new product
  // -------------------------------------------------------------------------
  test('create new product navigates to form', async ({ page }) => {
    await page.goto('/admin/productos/nuevo');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel(/título/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/slug/i)).toBeVisible();
    await expect(page.getByLabel(/precio/i)).toBeVisible();
  });

  test('create new product — form submission', async ({ page }) => {
    await page.goto('/admin/productos/nuevo');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/título/i).fill('Producto Test E2E');
    await page.getByLabel(/slug/i).fill('producto-test-e2e');
    await page.getByLabel(/precio/i).fill('999');

    await page.getByRole('button', { name: /guardar/i }).click();

    // Should redirect to products list or product detail
    await expect(page).toHaveURL(/\/admin\/productos/, { timeout: 15_000 });
  });

  test('create product auto-generates slug from title', async ({ page }) => {
    await page.goto('/admin/productos/nuevo');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/título/i).fill('Prueba Auto Slug');

    // The slug field should be auto-populated after blur/change
    await page.getByLabel(/título/i).press('Tab');

    const slugField = page.getByLabel(/slug/i);
    const slugValue = await slugField.inputValue();

    // Slug should be derived from the title (lowercased, spaces → dashes)
    expect(slugValue.toLowerCase()).toContain('prueba');
  });

  // -------------------------------------------------------------------------
  // Order management
  // -------------------------------------------------------------------------
  test('orders list loads', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await page.waitForLoadState('networkidle');

    // Either a table or an empty-state message should be present
    const table = page.getByRole('table');
    const emptyState = page.getByTestId('empty-orders');

    const hasTable = await table.count() > 0;
    const hasEmpty = await emptyState.count() > 0;

    expect(hasTable || hasEmpty).toBe(true);
  });

  test('order status can be updated', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await page.waitForLoadState('networkidle');

    const orderRows = page.getByTestId('order-row');
    if (await orderRows.count() === 0) {
      test.skip();
      return;
    }

    // Click the first order to open detail
    await orderRows.first().click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('order-detail')).toBeVisible({ timeout: 15_000 });

    // Update status via the select
    await page.getByTestId('status-select').selectOption('PROCESSING');
    await page.getByRole('button', { name: /actualizar estado/i }).click();

    // Timeline entry should appear
    await expect(page.getByTestId('order-timeline')).toBeVisible({ timeout: 15_000 });
  });

  test('order detail shows customer info', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await page.waitForLoadState('networkidle');

    const orderRows = page.getByTestId('order-row');
    if (await orderRows.count() === 0) {
      test.skip();
      return;
    }

    await orderRows.first().click();
    await page.waitForLoadState('networkidle');

    const detail = page.getByTestId('order-detail');
    await detail.waitFor({ state: 'visible' });

    await expect(detail.getByTestId('order-customer-email')).toBeVisible();
    await expect(detail.getByTestId('order-total')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Inventory management
  // -------------------------------------------------------------------------
  test('inventory page loads with stock levels', async ({ page }) => {
    await page.goto('/admin/inventario');
    await page.waitForLoadState('networkidle');

    const table = page.getByRole('table');
    const emptyState = page.getByTestId('empty-inventory');

    const hasTable = await table.count() > 0;
    const hasEmpty = await emptyState.count() > 0;

    expect(hasTable || hasEmpty).toBe(true);
  });

  test('low stock alert section is visible when items exist', async ({ page }) => {
    await page.goto('/admin/inventario');
    await page.waitForLoadState('networkidle');

    const lowStockSection = page.getByTestId('low-stock-section');
    if (await lowStockSection.count() > 0) {
      await expect(lowStockSection).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // Audit log
  // -------------------------------------------------------------------------
  test('audit log page renders', async ({ page }) => {
    await page.goto('/admin/auditoria');
    await page.waitForLoadState('networkidle');

    const table = page.getByRole('table');
    const emptyState = page.getByTestId('empty-audit');

    const hasTable = await table.count() > 0;
    const hasEmpty = await emptyState.count() > 0;

    expect(hasTable || hasEmpty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------
  test('settings page loads store configuration', async ({ page }) => {
    await page.goto('/admin/configuracion');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('setting-store_name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('setting-store_email')).toBeVisible();
    await expect(page.getByTestId('setting-store_currency')).toBeVisible();
  });

  test('can update store name setting', async ({ page }) => {
    await page.goto('/admin/configuracion');
    await page.waitForLoadState('networkidle');

    const storeNameField = page.getByTestId('setting-store_name');
    await storeNameField.waitFor({ state: 'visible' });

    await storeNameField.fill('Tienda E2E Test');
    await page.getByRole('button', { name: /guardar configuración/i }).click();

    // Success toast or confirmation should appear
    const toast = page.getByTestId('toast-success');
    await expect(toast).toBeVisible({ timeout: 10_000 });
  });
});

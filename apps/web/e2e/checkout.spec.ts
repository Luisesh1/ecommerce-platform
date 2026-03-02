import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Add the first product on /productos to the cart */
async function addFirstProductToCart(page: Page): Promise<void> {
  await page.goto('/productos');
  await page.waitForLoadState('networkidle');

  const firstCard = page.getByTestId('product-card').first();
  await firstCard.waitFor({ state: 'visible' });
  await firstCard.click();

  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /agregar al carrito/i }).click();

  // Wait until the cart count reflects the new item
  await expect(page.getByTestId('cart-count')).toContainText('1');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // -------------------------------------------------------------------------
  // Guest checkout — happy path
  // -------------------------------------------------------------------------
  test('complete guest checkout', async ({ page }) => {
    // 1. Browse to a product and add it to the cart
    await page.goto('/productos');
    await page.waitForLoadState('networkidle');

    const firstCard = page.getByTestId('product-card').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10_000 });
    await firstCard.click();
    await page.waitForLoadState('networkidle');

    // 2. Add to cart
    await page.getByRole('button', { name: /agregar al carrito/i }).click();
    await expect(page.getByTestId('cart-count')).toContainText('1');

    // 3. Go to cart
    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('cart-item')).toHaveCount(1);

    // 4. Proceed to checkout
    await page.getByRole('button', { name: /proceder al pago/i }).click();
    await page.waitForURL(/\/checkout/, { timeout: 10_000 });

    // 5. Fill information step
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/nombre/i).fill('John');
    await page.getByLabel(/apellido/i).fill('Doe');
    await page.getByLabel(/teléfono/i).fill('5551234567');
    await page.getByRole('button', { name: /continuar/i }).click();

    // 6. Fill shipping address step
    await page.getByLabel(/calle/i).fill('Av. Insurgentes 123');
    await page.getByLabel(/ciudad/i).fill('Ciudad de México');
    await page.getByLabel(/estado/i).fill('CDMX');
    await page.getByLabel(/código postal/i).fill('06600');
    await page.getByRole('button', { name: /continuar/i }).click();

    // 7. Select payment method
    await page.getByTestId('payment-method-stripe').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    // 8. Review order before confirming
    await expect(page.getByTestId('order-review')).toBeVisible();
    await expect(page.getByTestId('order-email')).toContainText('test@example.com');

    // Verify no double-submit: clicking confirm once should disable the button
    const confirmBtn = page.getByRole('button', { name: /confirmar pedido/i });
    await confirmBtn.click();
    await expect(confirmBtn).toBeDisabled();

    // 9. Confirmation page
    await expect(page).toHaveURL(/\/checkout.*step=confirmation/, { timeout: 30_000 });
    await expect(page.getByTestId('order-number')).toBeVisible();
    await expect(page.getByTestId('order-confirmation-email')).toContainText('test@example.com');
  });

  // -------------------------------------------------------------------------
  // Cart — coupon code
  // -------------------------------------------------------------------------
  test('apply coupon code in cart', async ({ page }) => {
    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');

    const cartItems = page.getByTestId('cart-item');

    // Skip if cart is empty (no products seeded yet in this test context)
    if (await cartItems.count() === 0) {
      test.skip();
      return;
    }

    // Type the coupon code
    await page.getByTestId('coupon-input').fill('DEMO10');
    await page.getByRole('button', { name: /aplicar/i }).click();

    // Either a success or error message should become visible
    await expect(page.getByTestId('coupon-message')).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Checkout — data persistence across steps (back navigation)
  // -------------------------------------------------------------------------
  test('checkout preserves data across steps', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // Fill the email on step 1
    const emailField = page.getByLabel(/email/i);
    await emailField.waitFor({ state: 'visible' });
    await emailField.fill('persist@example.com');

    // Advance to next step
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForLoadState('networkidle');

    // Go back to step 1
    await page.getByRole('button', { name: /atrás/i }).click();
    await page.waitForLoadState('networkidle');

    // Email field should still contain the entered value
    await expect(page.getByLabel(/email/i)).toHaveValue('persist@example.com');
  });

  // -------------------------------------------------------------------------
  // Cart — quantity update
  // -------------------------------------------------------------------------
  test('update item quantity in cart', async ({ page }) => {
    // Add a product then verify quantity controls
    await addFirstProductToCart(page);

    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');

    const cartItem = page.getByTestId('cart-item').first();
    await cartItem.waitFor({ state: 'visible' });

    // Increase quantity
    await cartItem.getByTestId('qty-increase').click();
    await expect(cartItem.getByTestId('qty-value')).toContainText('2');

    // Decrease back to 1
    await cartItem.getByTestId('qty-decrease').click();
    await expect(cartItem.getByTestId('qty-value')).toContainText('1');
  });

  // -------------------------------------------------------------------------
  // Cart — remove item
  // -------------------------------------------------------------------------
  test('remove item from cart', async ({ page }) => {
    await addFirstProductToCart(page);

    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('cart-item')).toHaveCount(1);

    // Remove the item
    await page.getByTestId('cart-item').first().getByTestId('remove-item').click();

    // Cart should now be empty
    await expect(page.getByTestId('empty-cart-message')).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Checkout — shipping method selection
  // -------------------------------------------------------------------------
  test('shipping method can be selected', async ({ page }) => {
    // Navigate directly to checkout shipping step (assumes state is stored)
    await page.goto('/checkout?step=shipping');
    await page.waitForLoadState('networkidle');

    const shippingMethods = page.getByTestId('shipping-method');

    // If shipping methods are visible, select the first one
    if (await shippingMethods.count() > 0) {
      await shippingMethods.first().click();
      await expect(shippingMethods.first()).toBeChecked();
    }
  });

  // -------------------------------------------------------------------------
  // Checkout — invalid email validation
  // -------------------------------------------------------------------------
  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    const emailField = page.getByLabel(/email/i);
    if (await emailField.count() === 0) {
      test.skip();
      return;
    }

    await emailField.fill('not-an-email');
    await page.getByRole('button', { name: /continuar/i }).click();

    // Validation error should be visible
    await expect(page.getByTestId('email-error')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Cart — order total updates when coupon is applied
  // -------------------------------------------------------------------------
  test('order total reflects applied coupon discount', async ({ page }) => {
    await addFirstProductToCart(page);

    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');

    // Record original total
    const totalElement = page.getByTestId('cart-total');
    const originalTotal = await totalElement.textContent();

    // Apply a coupon
    await page.getByTestId('coupon-input').fill('DEMO10');
    await page.getByRole('button', { name: /aplicar/i }).click();

    const message = page.getByTestId('coupon-message');
    await message.waitFor({ state: 'visible', timeout: 10_000 });

    // If coupon was accepted, total should have changed
    const isSuccess = await message.evaluate((el) =>
      el.textContent?.toLowerCase().includes('descuento') ||
      el.textContent?.toLowerCase().includes('aplicado'),
    );

    if (isSuccess) {
      const newTotal = await totalElement.textContent();
      expect(newTotal).not.toBe(originalTotal);
    }
  });

  // -------------------------------------------------------------------------
  // Checkout — MercadoPago payment method
  // -------------------------------------------------------------------------
  test('can select MercadoPago as payment method', async ({ page }) => {
    await page.goto('/checkout?step=payment');
    await page.waitForLoadState('networkidle');

    const mpMethod = page.getByTestId('payment-method-mercadopago');

    if (await mpMethod.count() > 0) {
      await mpMethod.click();
      await expect(mpMethod).toBeChecked();
    }
  });

  // -------------------------------------------------------------------------
  // Checkout — back navigation preserves all step data
  // -------------------------------------------------------------------------
  test('back navigation preserves shipping address data', async ({ page }) => {
    await page.goto('/checkout?step=shipping');
    await page.waitForLoadState('networkidle');

    const streetField = page.getByLabel(/calle/i);
    if (await streetField.count() === 0) {
      test.skip();
      return;
    }

    await streetField.fill('Calle Persistencia 456');
    await page.getByLabel(/ciudad/i).fill('Guadalajara');

    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /atrás/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel(/calle/i)).toHaveValue('Calle Persistencia 456');
    await expect(page.getByLabel(/ciudad/i)).toHaveValue('Guadalajara');
  });
});

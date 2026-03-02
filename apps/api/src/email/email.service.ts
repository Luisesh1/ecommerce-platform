import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY', ''));
    this.fromAddress = this.configService.get<string>('EMAIL_FROM', 'noreply@ecommerce.com');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://ecommerce.com');
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Verify your email</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>Thank you for registering. Please click the button below to verify your email address.</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
        <p style="color: #999; font-size: 12px;">Or copy and paste this URL: ${verifyUrl}</p>
      </body>
      </html>
    `;
    await this.sendEmail(email, 'Verify your email address', html);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Reset your password</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>You requested to reset your password. Click the button below to set a new password.</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
        <p style="color: #999; font-size: 12px;">Or copy and paste this URL: ${resetUrl}</p>
      </body>
      </html>
    `;
    await this.sendEmail(email, 'Reset your password', html);
  }

  async sendOrderConfirmation(order: any, email: string): Promise<void> {
    const orderUrl = `${this.frontendUrl}/orders/${order.orderNumber}`;
    const itemsHtml = (order.lineItems || [])
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title} - ${item.variantTitle}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.totalPrice / 100).toFixed(2)}</td>
        </tr>
      `,
      )
      .join('');
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Order Confirmation</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Order Confirmed!</h2>
        <p>Thank you for your order. We've received it and will start processing it shortly.</p>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; text-align: left;">Product</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="text-align: right; margin-top: 16px;">
          <p>Subtotal: <strong>$${(order.subtotal / 100).toFixed(2)}</strong></p>
          ${order.discountAmount > 0 ? `<p>Discount: <strong>-$${(order.discountAmount / 100).toFixed(2)}</strong></p>` : ''}
          <p>Shipping: <strong>$${(order.shippingAmount / 100).toFixed(2)}</strong></p>
          <p>Tax: <strong>$${(order.taxAmount / 100).toFixed(2)}</strong></p>
          <p style="font-size: 18px;">Total: <strong>$${(order.totalAmount / 100).toFixed(2)} ${order.currency}</strong></p>
        </div>
        <a href="${orderUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View Order
        </a>
      </body>
      </html>
    `;
    await this.sendEmail(email, `Order Confirmed - #${order.orderNumber}`, html);
  }

  async sendOrderShipped(order: any, trackingNumber: string, email: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Your order has shipped</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Your Order Has Shipped!</h2>
        <p>Great news! Your order #${order.orderNumber} is on its way.</p>
        <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
        ${order.trackingUrl ? `<a href="${order.trackingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Track Package</a>` : ''}
        <p style="color: #666; font-size: 14px;">Please allow 24 hours for tracking information to update.</p>
      </body>
      </html>
    `;
    await this.sendEmail(email, `Your order #${order.orderNumber} has shipped`, html);
  }

  async sendOrderDelivered(order: any, email: string): Promise<void> {
    const reviewUrl = `${this.frontendUrl}/orders/${order.orderNumber}/review`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Order Delivered</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Your Order Has Been Delivered!</h2>
        <p>Your order #${order.orderNumber} has been delivered. We hope you love your purchase!</p>
        <p>Would you like to leave a review?</p>
        <a href="${reviewUrl}" style="display: inline-block; padding: 12px 24px; background-color: #F59E0B; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Leave a Review
        </a>
        <p style="color: #666; font-size: 14px;">If you have any issues with your order, please contact our support team.</p>
      </body>
      </html>
    `;
    await this.sendEmail(email, `Order #${order.orderNumber} delivered`, html);
  }

  async sendRefundConfirmation(refund: any, email: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Refund Processed</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Refund Processed</h2>
        <p>Your refund has been processed successfully.</p>
        <p><strong>Refund Amount:</strong> $${(refund.amount / 100).toFixed(2)}</p>
        <p><strong>Reason:</strong> ${refund.reason}</p>
        <p style="color: #666; font-size: 14px;">Please allow 5-10 business days for the refund to appear on your statement, depending on your payment method.</p>
      </body>
      </html>
    `;
    await this.sendEmail(email, 'Your refund has been processed', html);
  }

  async sendAbandonedCartEmail(cart: any, email: string, coupon?: string): Promise<void> {
    const cartUrl = `${this.frontendUrl}/cart?session=${cart.sessionId || cart.id}`;
    const itemsHtml = (cart.items || [])
      .slice(0, 3)
      .map(
        (item: any) => `
        <div style="display: flex; align-items: center; margin: 8px 0; padding: 8px; border: 1px solid #eee; border-radius: 4px;">
          ${item.variant?.images?.[0] ? `<img src="${item.variant.images[0].url}" style="width: 60px; height: 60px; object-fit: cover; margin-right: 12px;" />` : ''}
          <div>
            <p style="margin: 0; font-weight: bold;">${item.variant?.product?.title || 'Product'}</p>
            <p style="margin: 0; color: #666;">Qty: ${item.quantity} - $${((item.variant?.price || 0) / 100).toFixed(2)}</p>
          </div>
        </div>
      `,
      )
      .join('');
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>You left something behind</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">You left something in your cart!</h2>
        <p>Don't forget about the items you left behind:</p>
        ${itemsHtml}
        ${coupon ? `<div style="background: #FEF3C7; padding: 16px; border-radius: 6px; margin: 16px 0;"><p style="margin: 0;"><strong>Special offer!</strong> Use code <strong>${coupon}</strong> for 10% off your order.</p></div>` : ''}
        <a href="${cartUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Complete Your Purchase
        </a>
      </body>
      </html>
    `;
    await this.sendEmail(email, "You left something in your cart", html);
  }

  async sendBackInStockNotification(product: any, email: string): Promise<void> {
    const productUrl = `${this.frontendUrl}/products/${product.slug}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Back in Stock</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Good News - Back in Stock!</h2>
        <p>The product you were waiting for is now available:</p>
        <h3>${product.title}</h3>
        ${product.images?.[0] ? `<img src="${product.images[0].url}" style="max-width: 200px; border-radius: 6px;" />` : ''}
        <p>Hurry, stock may be limited!</p>
        <a href="${productUrl}" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Shop Now
        </a>
      </body>
      </html>
    `;
    await this.sendEmail(email, `${product.title} is back in stock!`, html);
  }

  async sendPaymentFailed(order: any, email: string): Promise<void> {
    const checkoutUrl = `${this.frontendUrl}/checkout?order=${order.id}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Payment Failed</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #DC2626;">Payment Failed</h2>
        <p>We were unable to process your payment for order #${order.orderNumber}.</p>
        <p>This could be due to insufficient funds, an expired card, or your bank declining the transaction.</p>
        <a href="${checkoutUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Try Again
        </a>
        <p style="color: #666; font-size: 14px;">If you continue to have issues, please contact your bank or try a different payment method.</p>
      </body>
      </html>
    `;
    await this.sendEmail(email, `Payment failed for order #${order.orderNumber}`, html);
  }
}

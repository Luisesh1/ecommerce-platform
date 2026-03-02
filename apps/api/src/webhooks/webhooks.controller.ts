import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Stripe webhook events' })
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    await this.webhooksService.receiveStripeWebhook(rawBody, signature);
    return { received: true };
  }

  @Public()
  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive MercadoPago webhook events' })
  async mercadoPagoWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    await this.webhooksService.receiveMercadoPagoWebhook(body, headers);
    return { received: true };
  }

  @Public()
  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive PayPal webhook events' })
  async paypalWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    await this.webhooksService.receivePayPalWebhook(body, headers);
    return { received: true };
  }
}

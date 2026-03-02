import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Admin - Settings')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('api/admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiOperation({ summary: 'Get all settings grouped by namespace' })
  @Get()
  getAll() {
    return this.settingsService.getAllSettings();
  }

  @ApiOperation({ summary: 'Update settings (namespaced key-value pairs)' })
  @Patch()
  async updateSettings(@Body() body: Record<string, string>) {
    await this.settingsService.setMany(body);
    return { success: true };
  }

  @ApiOperation({ summary: 'Get all payment gateway configs (credentials masked)' })
  @Get('gateways')
  getGateways() {
    return this.settingsService.getAllGatewayConfigs();
  }

  @ApiOperation({ summary: 'Save a payment gateway config (encrypts credentials)' })
  @Patch('gateways/:name')
  async updateGateway(
    @Param('name') name: string,
    @Body() body: Record<string, string>,
  ) {
    await this.settingsService.setGatewayConfig(name, body);
    return { success: true };
  }

  @ApiOperation({ summary: 'Test gateway connection' })
  @HttpCode(HttpStatus.OK)
  @Post('gateways/:name/test')
  async testGateway(@Param('name') name: string) {
    const config = await this.settingsService.getGatewayConfig(name);

    // Basic check: ensure config has at least one key
    const keys = Object.keys(config).filter((k) => config[k] !== null);
    if (keys.length === 0) {
      return { success: false, message: `Gateway "${name}" has no configuration stored` };
    }

    // Gateway-specific health checks
    try {
      if (name === 'stripe') {
        const secretKey = await this.settingsService.get(`gateway:stripe:secret_key`);
        if (!secretKey) return { success: false, message: 'Stripe secret key not configured' };
        const Stripe = require('stripe');
        const stripe = new Stripe(secretKey);
        await stripe.accounts.retrieve();
        return { success: true, message: 'Stripe connection successful' };
      }

      if (name === 'mercadopago') {
        const accessToken = await this.settingsService.get(`gateway:mercadopago:access_token`);
        if (!accessToken) return { success: false, message: 'MercadoPago access token not configured' };
        const response = await fetch('https://api.mercadopago.com/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) return { success: true, message: 'MercadoPago connection successful' };
        return { success: false, message: `MercadoPago returned HTTP ${response.status}` };
      }

      if (name === 'paypal') {
        const clientId = await this.settingsService.get(`gateway:paypal:client_id`);
        const clientSecret = await this.settingsService.get(`gateway:paypal:client_secret`);
        if (!clientId || !clientSecret) {
          return { success: false, message: 'PayPal credentials not configured' };
        }
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });
        if (response.ok) return { success: true, message: 'PayPal connection successful' };
        return { success: false, message: `PayPal returned HTTP ${response.status}` };
      }

      return { success: true, message: `Gateway "${name}" config stored (no live test available)` };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}

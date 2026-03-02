import {
  Controller,
  Post,
  Get,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, PaymentGateway } from '@prisma/client';
import {
  CreatePaymentIntentDto,
  ConfirmPaymentDto,
  GatewayConfigDto,
} from './dto/payment.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @ApiOperation({ summary: 'Create payment intent' })
  createPaymentIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm payment' })
  confirmPayment(@Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirmPayment(id, dto);
  }

  @Get('gateways')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all payment gateway configs (admin)' })
  getGatewayConfigs() {
    return this.paymentsService.getGatewayConfigs();
  }

  @Post('gateways/:gateway')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Configure a payment gateway (admin)' })
  updateGatewayConfig(
    @Param('gateway') gateway: PaymentGateway,
    @Body() dto: GatewayConfigDto,
  ) {
    return this.paymentsService.updateGatewayConfig(
      gateway,
      dto.config,
      dto.isSandbox,
    );
  }

  @Post('gateways/:gateway/test')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Test gateway connection (admin)' })
  testGatewayConnection(@Param('gateway') gateway: PaymentGateway) {
    return this.paymentsService.testGatewayConnection(gateway);
  }
}

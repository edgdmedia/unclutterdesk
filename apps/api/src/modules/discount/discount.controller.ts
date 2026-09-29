import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DiscountService } from './discount.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { authenticatedTenantId } from '../../common/authenticated-tenant';

@ApiTags('Discounts')
@Controller('v1/discount')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Permissions('practice.admin')
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all discount codes for the practice' })
  listDiscounts(@Req() req: any) {
    return this.discountService.listDiscounts(authenticatedTenantId(req));
  }

  @Permissions('practice.admin')
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new discount code' })
  createDiscount(@Req() req: any, @Body() dto: any) {
    return this.discountService.createDiscount(authenticatedTenantId(req), dto);
  }

  @Permissions('practice.admin')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a discount code' })
  updateDiscount(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.discountService.updateDiscount(authenticatedTenantId(req), BigInt(id), dto);
  }

  @Permissions('practice.admin')
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deactivate a discount code' })
  deactivateDiscount(@Req() req: any, @Param('id') id: string) {
    return this.discountService.deactivateDiscount(authenticatedTenantId(req), BigInt(id));
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate a discount code against a price' })
  validateDiscount(@Body() dto: { tenantId: string; code: string; priceKobo: string }) {
    return this.discountService.validateDiscount(BigInt(dto.tenantId), dto.code, BigInt(dto.priceKobo));
  }
}

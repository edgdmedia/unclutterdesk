import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { authenticatedTenantId } from '../../common/authenticated-tenant';
import { LocationsService, LocationDto } from './locations.service';

@ApiTags('Tenant')
@Controller('v1/tenant/locations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  // Any staff member can see the list — therapists choose where they work.
  @Permissions('practice.staff')
  @Get()
  @ApiOperation({ summary: 'List the practice locations' })
  list(@Req() req: any) {
    return this.locations.list(authenticatedTenantId(req));
  }

  @Permissions('practice.admin')
  @Post()
  @ApiOperation({ summary: 'Add a location' })
  create(@Req() req: any, @Body() dto: LocationDto) {
    return this.locations.create(authenticatedTenantId(req), dto);
  }

  @Permissions('practice.admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Edit a location' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: LocationDto) {
    return this.locations.update(authenticatedTenantId(req), BigInt(id), dto);
  }

  @Permissions('practice.admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a location, refusing while future in-person sessions use it' })
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.locations.deactivate(authenticatedTenantId(req), BigInt(id));
  }
}

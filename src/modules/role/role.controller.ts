import { Controller, Get, Param, Patch, Query, UseGuards, Request, Body } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RoleService } from "./role.service";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";


@Controller('role')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoleController {

  constructor(private readonly roleService: RoleService) { }

  @Get()
  @Roles('Super Admin')
  async getRole(
    @Query() search: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {

    const { role, total } = await this.roleService.getRole(search, page, limit, sort, order);

    return {
      data: role,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  @Roles('Super Admin')
  async findOne(@Param('id') id: string, @Query() search: any) {

    return this.roleService.findOne(+id, search);
  }

  @Patch(':id/:flag')
  @Roles('Super Admin')
  async update(@Param('id') id: string, @Param('flag') flag: number) {
    return this.roleService.update(+id, flag);
  }



}
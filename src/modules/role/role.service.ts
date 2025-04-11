import { ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectEntityManager } from "@nestjs/typeorm";
import { DataSource, EntityManager, Not, SelectQueryBuilder } from "typeorm";
import { UsersService } from "../users/users.service";
import { User } from "src/interfaces/interfaces";
import { RoleSearch } from './interface/role.interface';

export const RoleSearchKeys = [
  'id', 'name', 'description', 'role_id', 'permission_id', 'is_active'
];

@Injectable()

export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private readonly usersService: UsersService,



  ) { }

  async getRole(
    search: RoleSearch = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ role: any[], total: number }> {

    page = Math.max(1, Number(page));

    limit = Math.max(1, Math.min(50, Number(limit)));

    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'ASC';

    const sortColumn = RoleSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('rp.id, rp.name, rp.description')
      .from('roles', 'rp')

    this.applyFilters(query, search);

    const total = 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`rp.${sortColumn}`, validOrder as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const role = await query.getRawMany();

    return { role, total };
  }

  async findOne(roleId: number, search?: any) {
    // Consulta optimizada
    try {
      const query = this.entityManager.createQueryBuilder()
        .select([
          'rp.id', 'rp.role_id', 'rp.permission_id', 'rp.is_active',
          'r.name as role_name', 'r.description as role_description',
          'p.name as permission', 'p.description',
          'mo.name as module_name', 'mo.description as module_description'
        ])
        .from('role_permissions', 'rp')
        .innerJoin('roles', 'r', 'rp.role_id = r.id')
        .innerJoin('modules', 'mo', 'rp.module_id = mo.id')
        .innerJoin('permissions', 'p', 'rp.permission_id = p.id')
        .where('rp.role_id = :roleId', { roleId })

      this.applyFiltersOnRone(query, search);

      const data = await query.getRawMany();

      return data;
    } catch (error) {
      // Mejorar manejo de errores
      this.logger.error(`Error al buscar permisos para rol ${roleId}: ${error.message}`);
      throw new InternalServerErrorException('Error al consultar permisos de rol');
    }
  }
  async update(id: number, flag: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('role_permissions')
      .set({ is_active: flag })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return {
      message: 'Role inactivated successfully',
      data: result.affected
    }
  }


  applyFilters(query: SelectQueryBuilder<any>, search: RoleSearch): void {

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {
        // if (key === 'tipo_persona' && value !== undefined) {
        //   query.andWhere(`ag.tipo_persona = :${key}`, { [key]: this.type(value) });
        // }

        if (typeof value === 'string' && key !== 'tipo_persona') {
          query.andWhere(`rp.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`rp.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  applyFiltersOnRone(query: SelectQueryBuilder<any>, search: any): void {

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {

        if (key === 'module_name' || key === 'module_description') {
          const filt = key === 'module_name' ? 'name' : 'description'
          query.andWhere(`mo.${filt} LIKE :${key}`, { [key]: `%${value}%` });
        }

        if (key === 'permission' || key === 'description') {
          const filt = key === 'permission' ? 'name' : 'description'
          query.andWhere(`p.${filt} LIKE :${key}`, { [key]: `%${value}%` });
        }

        if (typeof value === 'string' && key !== 'module_name' && key !== 'module_description' && key !== 'permission' && key !== 'description') {
          query.andWhere(`rp.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`rp.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  private async validateUser(email: string): Promise<User | any> {

    const user = await this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }
}
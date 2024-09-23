import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from './interface/user-interface';
import { InjectDataSource, InjectEntityManager, InjectRepository } from '@nestjs/typeorm';


@Injectable()
export class UsersService {


    constructor(
        @InjectEntityManager() private entityManager: EntityManager
    ) { }

    async findByUsername(username: string): Promise<any | null> {

        // Buscar en la tabla de admins
        const admin = await this.entityManager.query(
            'SELECT * FROM admins WHERE LOWER(email) = LOWER(?)',
            [username]
        );
        if (admin.length > 0) {
            return {
                id: `${admin[0].id}-admin`,
                email: admin[0].email,
                username: admin[0].nome,
                password: admin[0].password,
                role: 'admin',
            };
        }

        // Buscar en la tabla de agenti
        const agente = await this.entityManager.query(
            'SELECT * FROM agenti WHERE UPPER(email) = UPPER(?) AND stato != 0',
            [username]
        );
        if (agente.length > 0) {
            return {
                id: `${agente[0].id}-agente`,
                email: agente[0].sigla,
                username: agente[0].denominazione,
                password: agente[0].password,
                role: 'agente',
            };
        }


        const dealer = await this.entityManager.query(
            'SELECT * FROM dealers WHERE UPPER(pec) = UPPER(?) AND stato != 0',
            [username]
        );
        if (dealer.length > 0) {
            return {
                id: `${dealer[0].id}-dealer`,
                email: dealer[0].email,
                username: dealer[0].denominazione,
                password: dealer[0].password,
                role: 'dealer',
            };
        }

        return null;
    }


    async findLogin(email: string): Promise<User> {
        // const user = await this.entityManager.query(
        //     'SELECT * FROM admins WHERE LOWER(email) = LOWER(?)',
        //     [email]
        // );        

        const user = await this.findByUsername(email)

        if (!user) {
            throw new NotFoundException(`User with Email ${email} not found`);
        }

        return user as User;
    }


}

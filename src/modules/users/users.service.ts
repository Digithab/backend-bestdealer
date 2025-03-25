import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from './interface/user-interface';
import { InjectDataSource, InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { format } from 'date-fns';
import { MailService } from 'src/mail/mail.service';


@Injectable()
export class UsersService {


    constructor(
        @InjectEntityManager() private entityManager: EntityManager,
        private readonly mailService: MailService,
    ) { }

    async findByUsername(username: string): Promise<any | null> {

        // Buscar en la tabla de admins
        console.log('username___ ', username)
        const admin = await this.entityManager.query(
            'SELECT * FROM admins WHERE LOWER(email) = LOWER(?)',
            [username]
        );
        if (admin.length > 0) {
            return {
                id: `${admin[0].id}-admin`,
                email: admin[0].email,
                username: admin[0].nome,
                agente: 0,
                password: admin[0].password,
                role: 'admin',
            };
        }

        // Buscar en la tabla de agenti
        const agente = await this.entityManager.query(
            'SELECT * FROM agenti WHERE UPPER(sigla) = UPPER(?) AND stato != 0',
            [username]
        );
        if (agente.length > 0) {
            return {
                id: `${agente[0].id}-agente`,
                email: agente[0].email,
                agente: agente[0].id,
                sigla: agente[0].sigla,
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
                email: dealer[0].pec,
                agente: dealer[0].agente,
                username: dealer[0].denominazione,
                password: dealer[0].password,
                role: 'dealer',
            };
        }

        return null;
    }

    async findLogin(email: string): Promise<User> {

        const user = await this.findByUsername(email)

        if (!user) {
            throw new NotFoundException(`User with Email ${email} not found`);
        }

        return user as User;
    }

    async checkSiglaAgente(value: string) {
        console.log('Llega aqui', value)
        const [agenti] = await this.entityManager.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM agenti 
                WHERE UPPER(sigla) = UPPER(?) 
                AND stato != 0
            ) AS exists_flag    
        `, [value])
        console.log('agenti___ ', agenti)
        if (!agenti.exists_flag) {
            throw new NotFoundException(`Agente non trovato.`);
        }
    }

    async isEmailRespUsata(value: string) {
        const [email] = await this.entityManager.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM dealers__contatti dc 
                WHERE trim(UPPER(email)) = trim(UPPER(?)) 
                AND ruolo = 0
            ) AS exists_flag
        `, [value])

        if (!email.exists_flag) {
            throw new NotFoundException(`Email già in uso..`);
        }
    }

    async singup(data: any) {
        let status = false
        let mailTo = null

        await this.checkSiglaAgente(data.agente)

        if (data.email != "") {
            await this.isEmailRespUsata(data.email)

        }

        const PREZZI_DEFAULT_EXTRA = {
            soccorso_40km: '20.00',
            soccorso_60km: '25.00',
            soccorso_100km: '30.00',
            auto_sost: '10.00',
        };

        const PREZZI_CARD_DEFAULT_EXTRA = {
            soccorso_40km: '28.00',
            soccorso_60km: '33.00',
            soccorso_100km: '39.00',
            soccorso_camper: '180.00',
            rest_regionale: '28.00',
            rest_nazionale: '38.00',
        };
        const [agente] = await this.entityManager.query(`SELECT * 
            FROM agenti a 
            WHERE trim(UPPER(sigla)) = trim(UPPER(?))`, [data.agente])

        console.log('agente:::__', agente)
        // let mailCc = agente.email

        const has_contatto_amministrazione = (data.amministrazione_nome !== '' || data.amministrazione_tel !== '' ||
            data.amministrazione_cell !== '' || data.amministrazione_email !== '')

        const has_contatto_officina = (data.officina_nome !== '' || data.officina_tel !== '' ||
            data.officina_cell !== '' || data.officina_email !== '');

        const new_dealer = {
            agente: agente.id,
            tipo_persona: data.tipo_persona,
            denominazione: data?.denominazione?.toUpperCase() || '',
            cap: data.cap,
            comune: data.comune,
            indirizzo: data?.indirizzo?.toUpperCase() || '',
            civico: data.civico,
            email: data?.email?.toLowerCase() || '',
            pec: data.pec,
            cod_fiscale: data.cod_fiscale,
            partita_iva: data.partita_iva,
            cod_univoco: data.cod_univoco,
            password: data.password,
            soccorso__km: 0,
            soccorso__num_traini: 1,
            stato: 1,
            card_soccorso: data.attivazione_cards,
            data_proforma_singole_garanzie: 0,
            data_iscrizione: format(new Date(), "yyyy-MM-dd"),
            pagamento__data: 0,
            pagamento__rate: 1,
            pagamento__differita: 30,
            pagamento__periodo: 30,
        }

        const responsabile_new_dealer = {
            nome: data?.responsabile_nome?.toUpperCase() || '',
            telefono: data?.responsabile_tel?.toUpperCase() || '',
            cellulare: data?.responsabile_cell?.toUpperCase() || '',
            email: data?.responsabile_email?.toUpperCase() || '',
            ruolo: 0,
            dealer: 0
        }

        let amministrazione_new_dealer = null;
        let officina_new_dealer = null;

        if (has_contatto_amministrazione) {
            amministrazione_new_dealer = {
                nome: data?.amministrazione_nome?.toUpperCase() || '',
                telefono: data?.amministrazione_tel?.toUpperCase() || '',
                cellulare: data?.amministrazione_cell?.toUpperCase() || '',
                email: data?.amministrazione_email?.toUpperCase() || '',
                ruolo: 1,
                dealer: 0
            }
        }

        const resultDealer = await this.entityManager.createQueryBuilder()
            .insert()
            .into('dealers')
            .values(
                new_dealer
            )
            .execute();


        if (has_contatto_officina) {
            officina_new_dealer = {
                nome: data?.officina_nome?.toUpperCase() || '',
                telefono: data?.officina_tel?.toUpperCase() || '',
                cellulare: data?.officina_cell?.toUpperCase() || '',
                email: data?.officina_email?.toUpperCase() || '',
                ruolo: 2,
                dealer: resultDealer.raw?.insertId
            }
        }

        status = resultDealer ? true : false

        if (!status) return false

        responsabile_new_dealer.dealer = resultDealer.raw?.insertId

        const resultResponsible = await this.entityManager.createQueryBuilder()
            .insert()
            .into('dealers__contatti')
            .values(
                responsabile_new_dealer
            )
            .execute();

        mailTo = responsabile_new_dealer.email
        if (has_contatto_amministrazione) {
            const resulAdministrazione = await this.entityManager.createQueryBuilder()
                .insert()
                .into('dealers__contatti')
                .values(
                    responsabile_new_dealer
                )
                .execute();
        }

        if (has_contatto_officina) {
            const resulAdministrazione = await this.entityManager.createQueryBuilder()
                .insert()
                .into('dealers__contatti')
                .values(
                    officina_new_dealer
                )
                .execute();
        }

        let new_venditore = {
            nome: 'AZIENDA',
            dealer: resultDealer.raw?.insertId
        }

        const resultVenditore = await this.entityManager.createQueryBuilder()
            .insert()
            .into('dealers__venditori')
            .values(
                new_venditore
            )
            .execute();

        if (data.attivazione_garanzie) {
            const new_contratto_garanzie = {
                dealer: resultDealer.raw?.insertId,
                soccorso_40km: PREZZI_DEFAULT_EXTRA.soccorso_40km,
                soccorso_60km: PREZZI_DEFAULT_EXTRA.soccorso_60km,
                soccorso_100km: PREZZI_DEFAULT_EXTRA.soccorso_100km,
                auto_sost: PREZZI_DEFAULT_EXTRA.auto_sost,
                data_inizio_contratto: format(new Date(), "yyyy-MM-dd"),
                data_inserimento: format(new Date(), "yyyy-MM-dd")
            }

            const result = await this.entityManager.createQueryBuilder()
                .insert()
                .into('ordini__contratti_a_consumo')
                .values(
                    new_contratto_garanzie
                )
                .execute();

            for (let i = 1; i <= 3; i++) {
                const new_abilitazione = {
                    tipo_garanzia: i,
                    attivo: true,
                    dealer: resultDealer.raw?.insertId,
                }

                await this.entityManager.createQueryBuilder()
                    .insert()
                    .into('dealers__garanzie_abilitate')
                    .values(
                        new_abilitazione
                    )
                    .execute();

                const [prezzo] = await this.entityManager.query(`select prezzo_listino from tipi_garanzie tg where tg.id = ?`, [i])
                const new_prezzo_contratto = {
                    garanzia: i,
                    contratto: result.raw?.insertId,
                    prezzo_unitario: prezzo.prezzo_listino
                }

                await this.entityManager.createQueryBuilder()
                    .insert()
                    .into('ordini__contratti_a_consumo__quantita')
                    .values(
                        new_prezzo_contratto
                    )
                    .execute();
            }
        }

        if (data.attivazione_cards) {
            const new_contratto_cards = {
                dealer: resultDealer.raw?.insertId,
                soccorso_40km: PREZZI_CARD_DEFAULT_EXTRA.soccorso_40km,
                soccorso_60km: PREZZI_CARD_DEFAULT_EXTRA.soccorso_60km,
                soccorso_100km: PREZZI_CARD_DEFAULT_EXTRA.soccorso_100km,
                soccorso_camper: PREZZI_CARD_DEFAULT_EXTRA.soccorso_camper,
                rest_regionale: PREZZI_CARD_DEFAULT_EXTRA.rest_regionale,
                rest_nazionale: PREZZI_CARD_DEFAULT_EXTRA.rest_nazionale,
                data_inizio_contratto: format(new Date(), "yyyy-MM-dd"),
                data_inserimento: format(new Date(), "yyyy-MM-dd")
            }

            await this.entityManager.createQueryBuilder()
                .insert()
                .into('ordini__contratti_a_consumo_cardss')
                .values(
                    new_contratto_cards
                )
                .execute();
        }

        await this.notificaDisponibilita(new_dealer)
    }

    async notificaDisponibilita(dealer: any) {
        // info@bestdealer.it
        console.log('dealer___ ', dealer)
        await this.mailService.sendSignUpEmail(dealer.email, 'aetiru@gmail.com', 'aetiru@gmail.com', dealer.denominazione)

    }




}

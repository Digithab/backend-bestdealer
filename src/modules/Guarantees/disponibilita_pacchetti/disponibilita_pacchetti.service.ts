import { ForbiddenException, Injectable, Logger, NotFoundException, UseGuards } from '@nestjs/common';
import { CreateDisponibilitaPacchettiDto } from './dto/create-disponibilita_pacchetti.dto';
import { UpdateDisponibilitaPacchettiDto } from './dto/update-disponibilita_pacchetti.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DisponibilitaResult, Garanzia, PackageQuantity } from './interface/disponibilita_pacchetti.types';
import { User } from 'src/interfaces/interfaces';
import { UsersService } from 'src/modules/users/users.service';
import { MailService } from 'src/mail/mail.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Injectable()
export class DisponibilitaPacchettiService {
  private readonly logger = new Logger(DisponibilitaPacchettiService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private readonly usersService: UsersService,
    private readonly mailService: MailService,

  ) { }

  async getAllDisponibilitaSearch(
    page: number = 1,
    limit: number = 10,
    id?: string,
    sigla?: string,
  ) {
    try {
      // Ensure numbers are valid
      const validPage = Math.max(1, Number(page));
      const validLimit = Math.max(1, Number(limit));
      const offset = (validPage - 1) * validLimit;

      // Build the WHERE clause dynamically
      const whereConditions = [];
      const params: any = [];

      if (id) {
        console.log('Entra: ', id)
        whereConditions.push("d.id = ?");
        params.push(`${id}`);
      }

      if (sigla) {
        whereConditions.push("a.sigla LIKE ?");
        params.push(`%${sigla}%`);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count for pagination
      const [totalCount] = await this.entityManager.query(
        `SELECT COUNT(DISTINCT CONCAT(d.denominazione, a.sigla)) as total
         FROM view_pack_acquistati vpa
         JOIN dealers d ON vpa.dealer = d.id
         JOIN agenti a ON d.agente = a.id
         ${whereClause}`,
        params
      );

      // Main query with pagination
      const query = `
        SELECT
        d.id,
          d.denominazione,
          a.sigla,
          a.denominazione AS agente,
          vpa.cnt,
          vd.dealer,
          SUM(CASE WHEN vd.prodotto = 1 THEN vd.disponibilidad_total ELSE 0 END) AS "BEST_A",
          SUM(CASE WHEN vd.prodotto = 2 THEN vd.disponibilidad_total ELSE 0 END) AS "BEST_B",
          SUM(CASE WHEN vd.prodotto = 3 THEN vd.disponibilidad_total ELSE 0 END) AS "BEST_C",
          SUM(CASE WHEN vd.prodotto = 4 THEN vd.disponibilidad_total ELSE 0 END) AS "GEST_A",
          SUM(CASE WHEN vd.prodotto = 5 THEN vd.disponibilidad_total ELSE 0 END) AS "GEST_B",
          SUM(CASE WHEN vd.prodotto = 6 THEN vd.disponibilidad_total ELSE 0 END) AS "GEST_C",
          SUM(CASE WHEN vd.prodotto = 7 THEN vd.disponibilidad_total ELSE 0 END) AS "GEST_wD",
          SUM(CASE WHEN vd.prodotto = 8 THEN vd.disponibilidad_total ELSE 0 END) AS "DDC"
        FROM view_pack_acquistati vpa
        JOIN dealers d ON vpa.dealer = d.id
        JOIN agenti a ON d.agente = a.id
        LEFT JOIN v_dealer_disponibilita vd ON vd.dealer = d.id
        ${whereClause}
        GROUP BY d.id, d.denominazione, a.sigla, a.denominazione, vpa.cnt, vd.dealer
        ORDER BY d.denominazione
        LIMIT ${validLimit} OFFSET ${offset}
      `;

      const results = await this.entityManager.query(query, params);

      return {
        data: results,
        pagination: {
          total: parseInt(totalCount.total),
          page: validPage,
          limit: validLimit,
          totalPages: Math.ceil(parseInt(totalCount.total) / validLimit),
        },
      };
    } catch (error) {
      this.logger.error('Error calculating disponibilita', error.stack);
      throw error;
    }
  }

  async getAllDisponibilita() {

    try {
      const disponibilita = await this.entityManager.query(
        `   SELECT 
    d.denominazione,
        a.sigla,
        a.denominazione AS agente,
        vpa.cnt,
        vd.dealer,
        SUM(CASE WHEN vd.prodotto = 1 THEN vd.disponibilidad_total ELSE 0 END) AS "BEST_A",
        SUM(CASE WHEN vd.prodotto = 2 THEN vd.disponibilidad_total ELSE 0 END) AS "BEST_B",
        SUM(CASE WHEN vd.prodotto = 3 THEN vd.disponibilidad_total ELSE 0 END) AS "BEST_C",
        SUM(CASE WHEN vd.prodotto = 4 THEN vd.disponibilidad_total ELSE 0 END) AS "GEST_A",
        SUM(CASE WHEN vd.prodotto = 5 THEN vd.disponibilidad_total ELSE 0 END) AS "GEST_B",
        SUM(CASE WHEN vd.prodotto = 6 THEN vd.disponibilidad_total ELSE 0 END) AS "GEST_C",
        SUM(CASE WHEN vd.prodotto = 7 THEN vd.disponibilidad_total ELSE 0 END) AS "GEST_wD",
        SUM(CASE WHEN vd.prodotto = 8 THEN vd.disponibilidad_total ELSE 0 END) AS "DDC"
FROM 
    view_pack_acquistati vpa 
JOIN 
    dealers d ON vpa.dealer = d.id
JOIN 
    agenti a ON d.agente = a.id
LEFT JOIN 
    v_dealer_disponibilita vd ON vd.dealer = d.id
GROUP BY 
    d.denominazione, a.sigla, a.denominazione, vpa.cnt, vd.dealer
ORDER BY 
    d.denominazione;
`
      )
      return disponibilita

    } catch (error) {
      this.logger.error('Error calculating disponibilita', error.stack);
      throw error;
    }
  }

  async getAllDisponibilitaDealer(dealer: string) {

    try {
      const disponibilita = await this.entityManager.query(
        `select * from v_dealer_disponibilita where dealer = ?;
`, [dealer]
      )
      return disponibilita

    } catch (error) {
      this.logger.error('Error calculating disponibilita', error.stack);
      throw error;
    }
  }

  async getDisponibilitaSoccorso(dealer: any, km_soccorso_pid) {
    const [soccorso] = await this.entityManager.query(
      'SELECT disponibilidad FROM v_disponibilita_soccorso WHERE dealer = ? AND km_soccorso_pid = ?',
      [dealer, km_soccorso_pid]
    )

    if (soccorso === undefined || soccorso === null) {
      return 0
    }
    return soccorso.disponibilidad
  }

  async getDisponibilita_extras(dealer: any, tipo_extra: any) {
    const result = await this.entityManager.query(
      'SELECT disponibilidad FROM v_disponibilita_extras WHERE dealer = ? AND tipo_extra = ?',
      [dealer, tipo_extra]
    )



    // Check if result exists and has at least one row
    if (!result || result.length === 0) {
      return 0
    }

    // Extract the first row's disponibilidad value
    return result[0].disponibilidad || 0
  }

  async getDisponibilitaSoccorsiAndAuto(dealer: any) {
    const results = await Promise.all([
      this.getDisponibilitaSoccorso(dealer, 1),
      this.getDisponibilitaSoccorso(dealer, 2),
      this.getDisponibilitaSoccorso(dealer, 3),
      this.getDisponibilita_extras(dealer, 5)
    ]);

    return {
      1: results[0],
      2: results[1],
      3: results[2],
      5: results[3]
    };
  }

  async getAllPackAcquistati() {
    const pack_acquistati = this.entityManager.query(
      'SELECT * FROM view_pack_acquistati'
    )
    return pack_acquistati
  }

  async getPackAcquistatiDealer(dealer: number) {
    const dealer_pack_acquistati = this.entityManager.query(
      'SELECT * FROM view_pack_acquistati_dealer WHERE dealer = ?',
      [dealer]
    )
    return dealer_pack_acquistati
  }

  async getAllProdottiAcquistati() {
    const prodotti_acquistati = this.entityManager.query(
      'SELECT * FROM view_prodotti_acquistati'
    )
    return prodotti_acquistati
  }

  private organizePackages(packages: PackageQuantity[]): Record<number, Record<number, PackageQuantity[]>> {
    return packages.reduce((acc, pack) => {
      if (!acc[pack.dealer]) {
        acc[pack.dealer] = {};
      }
      if (!acc[pack.dealer][pack.prodotto]) {
        acc[pack.dealer][pack.prodotto] = [];
      }
      acc[pack.dealer][pack.prodotto].push(pack);
      return acc;
    }, {} as Record<number, Record<number, PackageQuantity[]>>);
  }

  private async getGaranzieByDealer(queryRunner: any, dealer: number): Promise<Garanzia[]> {
    return queryRunner.query(`
      SELECT id, tipo_garanzia, data_attivazione, durata
      FROM garanzie
      WHERE dealer = ?
        AND is_imported = 0
        AND consumo_pack >= 0
    `, [dealer]);
  }

  private organizeGaranzie(garanzie: Garanzia[]): Record<number, Garanzia[]> {
    return garanzie.reduce((acc, garanzia) => {
      if (!acc[garanzia.tipo_garanzia]) {
        acc[garanzia.tipo_garanzia] = [];
      }
      acc[garanzia.tipo_garanzia].push(garanzia);
      return acc;
    }, {} as Record<number, Garanzia[]>);
  }

  private calculateDisponibilita(
    packs: PackageQuantity[],
    garanzie: Garanzia[],
    currentDate: Date
  ): number {
    return packs.reduce((total, pack) => {
      if (new Date(pack.scadenza) >= currentDate) {
        const garantiasUtilizadas = garanzie.filter(gr =>
          new Date(gr.data_attivazione) >= new Date(pack.attivazione) &&
          new Date(gr.data_attivazione) <= new Date(pack.scadenza)
        ).length;

        return total + Math.max(0, pack.tot - garantiasUtilizadas);
      }
      return total;
    }, 0);

  }

  async actionNotificaSelezionati(sel: any, userId: string) {

    const user = await this.validateUser(userId);

    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear garantías');
    }

    for (const id_dealers of sel) {
      const [dealer] = await this.entityManager.query('SELECT * FROM dealers WHERE id = ?', [id_dealers])
      if (dealer) {
        const cc: string[] = [];

        const [agenti] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [dealer.agente])
        const contatti = await this.entityManager.query('SELECT * FROM dealers__contatti WHERE dealer = ?', [id_dealers])

        if (agenti) cc.push(agenti.email);

        const prod_acquistati = await this.getAllProdottiAcquistati()

        const all_disponibilita = await this.entityManager.query('select * from v_dealer_disponibilita WHERE dealer = ?', [id_dealers])
        const tipi_garanzie = await this.entityManager.query('select * from tipi_garanzie')
        console.log('all_disponibilita___ ', all_disponibilita)
        const prodotti = all_disponibilita.map(d => {
          const prod = prod_acquistati.find(p => p.dealer === d.dealer && p.prodotto === d.prodotto)
          return {
            id: d.prodotto,
            denominazione: tipi_garanzie.find(t => t.id === d.prodotto).denominazione,
            cantidad: d.disponibilidad_total,
          }
        })
        console.log('prodotti___', prodotti)

        contatti.slice(1, 3).forEach(contatto => {
          const email = contatto?.email;
          if (email) cc.push(email);
        });

        // Enviar correo -> contatti[0].email > colocar email de prueba
        // Correo del agente CC -> agenti[0].email    
        console.log('Enviando correo....')
        await this.mailService.sendGarantiasEmail('aetiru@gmail.com', cc, 'aetiru@gmail.com', prodotti, dealer.denominazione);
      }
    }

  }

  private async validateExtension(garantiaId: number, user: User) {
    const garantiaToExtend = await this.dataSource.query(
      `SELECT * FROM garanzie WHERE id = ?`,
      [garantiaId]
    );

    if (!garantiaToExtend[0]) {
      throw new NotFoundException('La garantía a extender no fue encontrada');
    }

    // Validar que el dealer solo pueda extender sus propias garantías
    if (
      user.role === 'dealer' &&
      garantiaToExtend[0].dealer !== parseInt(user.id.split('-')[0])
    ) {
      throw new ForbiddenException('No tienes permiso para extender esta garantía');
    }

    return garantiaToExtend[0];
  }

  private validateUser(email: string): Promise<User> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }
}

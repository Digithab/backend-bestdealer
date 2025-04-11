import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFaturreDto } from './dto/create-faturre.dto';
import { UpdateFaturreDto } from './dto/update-faturre.dto';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { FattureSearch } from './interface/fatture.types';
import { User } from 'src/interfaces/interfaces';
import { UsersService } from 'src/modules/users/users.service';
import { format, getYear, parseISO } from 'date-fns';
import { MailService } from 'src/mail/mail.service';
import { ProformaService } from '../proforma/proforma.service';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';

export const FattureSearchCardKeys = [
  'denominazione',
  'sigla',
  'id',
  'rif_proforma',
  'progressivo_ft_annuale',
  'anno_ft',
  'data_fattura',
  'tipo_fattura',
  'rif_ft_nota_credito',
  'descr_nota_credito',
  'ProgressivoInvio',
  'importo_ft',
  'incasso',
  'commento',
  'data_primo_invio',
  'data_inserimento',
  'contabilizza',
  'is_deleted',
  'fileXML'
]

@Injectable()
export class FattureService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    private mailService: MailService,
    private proformaService: ProformaService,
    private genPdfService: GenPdfService
  ) { }

  async getFattureEmesse(id: string) {
    const faturre = await this.dataSource
      .createQueryBuilder()
      .select('f.*')
      .from('fatture', 'f')
      .where('f.rif_fatture = :rif_fatture', { id })

    return faturre
  }
  async create(data: any, userId: string) {
    // Validación temprana del usuario
    const user = await this.validateUser(userId);
    console.log('user.permissions: ', user.permissions)
    if (!user.permissions.includes('fatture:create')) {
        throw new ForbiddenException('No tienes permisos para crear facturas');
    }

    let fatturaId: any;

    const currentDate = format(new Date(), 'yyyy-MM-dd');

    data.data_fattura = currentDate;

    await this.dataSource.transaction(async (manager) => {
      const id_proforma = data.id_proforma;


      // Obtener la proforma en paralelo con la consulta de progressivo
      const [proforma, progQuery, progInvioQuery] = await Promise.all([
        manager.query(`SELECT * FROM proforma WHERE id = ?`, [id_proforma]),
        manager.query(`
        SELECT MAX(CAST(progressivo_ft_annuale AS UNSIGNED)) as prog
        FROM fatture
        WHERE anno_ft = ? AND contabilizza = true;
      `, [data.anno_ft]),
        // Obtenemos también el ProgressivoInvio de una vez
        manager.query(`SELECT MAX(CAST(ProgressivoInvio AS UNSIGNED)) as prog FROM fatture`)
      ]);

      // Preparar valores base de la factura
      const baseValues = {
        rif_proforma: id_proforma,
        is_deleted: false,
        data_inserimento: format(new Date(), 'yyyy-MM-dd'),
        data_primo_invio: '1900-01-01',
        progressivo_ft_annuale: data.contabilizza ? Number(progQuery[0].prog) + 1 : progQuery[0].prog,
        ProgressivoInvio: data.contabilizza ? Number(progInvioQuery[0].prog) + 1 : 0,
        tipo_fattura: ''
      };

      // Calcular valores financieros
      const tot_proforma = parseFloat(proforma[0].importo) +
        Math.round(proforma[0].importo * (data.iva / 100) * 100) / 100;

      const fatturato = await this.getFatturato(id_proforma);
      const da_saldare = Math.round(tot_proforma - fatturato);

      // Validar el monto
      if (Math.round(parseFloat(proforma[0].importo_ft) * 100) / 100 > da_saldare) {
        throw new BadRequestException('El monto de la factura excede el saldo pendiente');
      }

      // Determinar tipo de factura y preparar el objeto final
      const fatture = {
        ...baseValues,
        ...data,
        tipo_fattura: proforma[0].importo_ft === da_saldare ? 'TD01' : 'TD02'
      };

      // Eliminar id_proforma ya que no es parte de la tabla fatture
      delete fatture.id_proforma;

      // Insertar la factura
      const f_found = await manager
        .createQueryBuilder()
        .insert()
        .into('fatture')
        .values(fatture)
        .execute();

      fatturaId = f_found.raw?.insertId;

    });

    if (fatturaId) {
      // Generar documentos y registrar log en paralelo
      await Promise.all([
        this.genDocsFattura(fatturaId, true),
        this.genDocsFattura(fatturaId, false),
        this.dataSource
          .createQueryBuilder()
          .insert()
          .into('log')
          .values({
            user: user.id,
            operazione: 1,
            record_table: 'fatture',
            record_id: fatturaId
          })
          .execute()
      ]);
    }
    return { success: true, fatturaId };
  }

  async getfatture(
    search: FattureSearch = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{
    fatture: any[], total: number, importo_total: number, incaso_total: number, saldo_total: number
  }> {
    // , importo_total: number, incwaso_total: number, saldo_total: number
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['DESC', 'ASC'].includes(order) ? order : 'DESC';
    const sortColumn = FattureSearchCardKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('vp.*')
      .from('v_fatture', 'vp')
    this.applyFilters(query, search);


    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;
    const importoResult = await totalQueryBuilder.select('SUM(vp.importo_ft) as importo_total, SUM(vp.incasso) as incaso_total, SUM(vp.saldo) as saldo_total').getRawOne();
    const importo_total = Number(importoResult?.importo_total || 0);
    const incaso_total = Number(importoResult?.incaso_total || 0)
    const saldo_total = Number(importoResult?.saldo_total || 0)
    // Aplicar ordenación y paginación
    query
      .orderBy(`vp.${sortColumn}`, validOrder as 'DESC' | 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const fatture = await query.getRawMany();

    // , importo_total, incaso_total, saldo_total
    return { fatture, total, importo_total, incaso_total, saldo_total };
  }

  async findOne(id: number) {

    const [fatture] = await await this.entityManager.query(`SELECT * FROM fatture WHERE id = ?`, [id])

    return fatture;
  }

  update(id: number, updateFaturreDto: UpdateFaturreDto) {
    return `This action updates a #${id} faturre`;
  }

  async remove(id: number, userId) {
    return await this.dataSource.transaction(async (manager) => {
      const user = await this.validateUser(userId);

      if (user.role !== 'admin') return

      await manager
        .createQueryBuilder()
        .update('fatture')
        .set({ is_deleted: true })
        .set({ rif_ft_nota_credito: id })
        .where('id = :id', { id: id })
        .execute();

      const log = {
        operazione: 3,
        record_table: 'fatture',
        record_id: id
      }

      await manager
        .createQueryBuilder()
        .insert()
        .into('log')
        .values(
          log
        )
        .execute();
    })
  }

  async getFatturato(id: string): Promise<number> {
    const [fatturato] = await this.entityManager.query('select COALESCE(SUM(f.importo_ft), 0) AS futt from fatture f where f.rif_proforma = ?', [id]);

    return fatturato.futt;
  }

  applyFilters(query: SelectQueryBuilder<any>, search: FattureSearch): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {
        if (value && key === 'data_fattura' || key === 'data_primo_invio') {
          const newValue = JSON.parse(value)

          const fromDate = newValue.from;
          const toDate = newValue.to;
          query.andWhere(
            `DATE(vp.${key}) BETWEEN :${key}From AND :${key}To`,
            {
              [`${key}From`]: fromDate,
              [`${key}To`]: toDate
            }
          )
        }

        if (key === 'tipo_fattura' && value) {
          if (value == "Saldo") {
            query.andWhere(`vp.${key} = :${key}`, { [key]: "TD01" });
          }

          if (value == "Acconto") {
            query.andWhere(`vp.${key} >= :${key}`, { [key]: "TD02" });
          }
          if (value === "Nota Credito") {
            query.andWhere(`vp.${key} >= :${key}`, { [key]: "TD04" });
          }
        }

        if (typeof value === 'string' && key !== 'data_fattura' && key !== 'data_primo_invio' && key !== 'tipo_fattura') {
          query.andWhere(`vp.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`vp.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  async actionInviaFattura(id: any, userId) {
    const user = await this.validateUser(userId);

    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear garantías');
    }

    const [fatture] = await this.entityManager.query('SELECT * FROM fatture WHERE id = ?', [id]);
    const [proforma] = await this.entityManager.query('SELECT * FROM proforma WHERE id = ?', [fatture.rif_proforma]);


    let to = '';
    let cc = [];
    let ccN = 'info@bestdealer.it';
    let subject = '';

    switch (proforma.tipo_cliente) {
      case 0:
        const [dealer] = await this.entityManager.query('SELECT denominazione FROM dealers WHERE id = ?', [proforma.id_cliente])
        console.log('dealer::: ', dealer)
        subject = `Invio Fattura: Dealer ${dealer.denominazione}`
        const contatti = await this.entityManager.query('SELECT * FROM dealers__contatti WHERE dealer = ?', [proforma.id_cliente])
        const [agenti] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [proforma.id_cliente])

        if (agenti) cc.push(agenti.email);
        contatti.slice(1, 3).forEach(contatto => {
          const email = contatto?.email;
          if (email) cc.push(email);
        });
        break;
      default:
        throw new NotFoundException('La risorsa richiesta non è stata trovata.');
        break;
    }

    console.log('Enviando correo....')
    await this.mailService.sendFattureEmail('aetiru@gmail.com', 'aetiru@gmail.com', 'aetiru@gmail.com', fatture.anno_ft, format(new Date(fatture.data_fattura), 'dd/MM/yyyy'), subject)

    if (format(new Date(fatture.data_primo_invio), 'yyyy-MM-dd') === '1900-01-01') {
      fatture.data_primo_invio = format(new Date(), 'yyyy-MM-dd');
      if (fatture.ProgressivoInvio === '' && fatture.fileXML === '') {
        const prog = await this.entityManager.query('SELECT MAX(CAST(ProgressivoInvio AS UNSIGNED)) FROM fatture');
        fatture.ProgressivoInvio = Number(prog) + 1;
        await this.entityManager
          .createQueryBuilder()
          .update('fatture')
          .set(fatture)
          .where('id = :id', { id: id })
          .execute();
      }
    }
  }

  // private validateUser(email: string): Promise<User | any> {

  //   const user = this.usersService.findByUsername(email)

  //   if (!user) throw new NotFoundException('Usuario no encontrado');

  //   return user;
  // }

  private async validateUser(email: string): Promise<User | any> {
    const user = await this.usersService.findByUsername(email);
    
    if (!user) {
        throw new NotFoundException('Usuario no encontrado');
    }
    
    const hasModuleAccess = user.permissions.some(permission => 
        permission.startsWith('fatture:')
    );
    
    if (!hasModuleAccess) {
        throw new ForbiddenException('No tienes acceso al módulo de facturas');
    }

    return user;
  }

  async genDocsFattura(id: any, xml: boolean) {
    console.log('id___ ', id)
    const [model] = await this.entityManager.query('SELECT * FROM fatture WHERE id = ?', [id]);
    console.log('model___ ', model)
    if (!model) {
      throw new NotFoundException('La risorsa richiesta non è stata trovata.');
    }

    const [proforma] = await this.entityManager.query('SELECT * FROM proforma WHERE id = ?', [model.rif_proforma]);

    let cliente = {}

    const fattura = {
      id: model.id,
      num_fattura: model.contabilizza ? `${model.progressivo_ft_annuale}/${model.anno_ft}` : `XXX/${model.anno_ft}`,
      tipo_fattura: model.tipo_fattura,
      data: format(new Date(model.data_fattura), 'dd/MM/yyyy'),
      data_orig: model.data_fattura,
      prog_invio: model.ProgressivoInvio,
      corpo: [],
      rif_acconti: [],
      tot_proforma: '',
      tot_dovuto: model.importo_ft,
    }

    switch (proforma.tipo_cliente) {
      case 0: // Dealer

        const [dealer] = await this.entityManager.query('SELECT * FROM dealers WHERE id = ?', [proforma.id_cliente]);
        if (!dealer) {
          throw new NotFoundException('La risorsa richiesta non è stata trovata.');
        }
        const citta = await this.entityManager.query('SELECT * FROM comuni WHERE id = ?', [dealer.comune]);
        if (!citta) {
          throw new NotFoundException('La risorsa richiesta non è stata trovata.');
        }

        cliente = {
          tipo_cliente: proforma.tipo_cliente,
          rag_sociale: dealer.denominazione,
          indirizzo: dealer.indirizzo,
          civico: dealer.civico,
          cap: dealer.cap,
          citta: citta.citta,
          provincia: citta.provincia,
          partita_iva: dealer.partita_iva,
          pec: dealer.pec,
          cod_univoco: dealer.cod_univoco,
        }
        break;
      case 1: // Cliente
        const [client] = await this.entityManager.query('SELECT * FROM clienti WHERE id = ?', [proforma.id_cliente]);
        if (!client || !client.abilitazione_proforma) {
          throw new NotFoundException('La risorsa richiesta non è stata trovata CLIENTI.');
        }
        const comune = await this.entityManager.query('SELECT * FROM comuni WHERE id = ?', [client.comune]);
        if (!comune) {
          throw new NotFoundException('La risorsa richiesta non è stata trovata COMUNI.');
        }

        cliente = {
          tipo_cliente: proforma.tipo_cliente,
          rag_sociale: client.denominaziclientone,
          indirizzo: client.indirizzo,
          civico: client.civico,
          cap: client.cap,
          citta: comune.citta,
          provincia: comune.provincia,
          partita_iva: client.codfisc_piva,
          pec: client.pec,
          cod_univoco: client.cod_univoco,
        }
        break;
      case 2:// Centro convenzionato
        const [centri] = await this.entityManager.query('SELECT * FROM centri_convenzionati WHERE id = ?', [proforma.id_cliente]);
        if (!centri) {
          throw new NotFoundException('La risorsa richiesta non è stata trovata.');
        }
        const comu = await this.entityManager.query('SELECT * FROM comuni WHERE id = ?', [dealer.comune]);
        if (!comu) {
          throw new NotFoundException('La risorsa richiesta non è stata trovata.');
        }

        cliente = {
          tipo_cliente: proforma.tipo_cliente,
          rag_sociale: centri.denominazione,
          indirizzo: centri.indirizzo,
          civico: centri.civico,
          cap: centri.cap,
          citta: comu.citta,
          provincia: comu.provincia,
        }
        break;
        break
      default:
        throw new NotFoundException('No sirve')

    }

    // Viene controllato se la fattura è di saldo, di acconto, o nota di credito
    switch (model.tipo_fattura) {
      case 'TD02': // Acconto        
        fattura.corpo.push({
          descrizione: `Acconto su fornitura (documento n. ${proforma.id} del ${format(new Date(proforma.data_proforma), 'dd/MM/yyyy')})`,
          prezzo_unitario: (model.importo_ft * 100 / 122).toFixed(2).replace('.', ','),
          quantita: 1,
          totale: (model.importo_ft * 100 / 122).toFixed(2).replace('.', ','),
          totale_orig: (model.importo_ft * 100 / 122).toFixed(2).replace('.', ',')
        })
        break
      case 'TD01': // Saldo
        const dati_proforma = await this.proformaService.createCorpoProforma(proforma)
        fattura.corpo = dati_proforma.corpo
        console.log('fattura.corpo___ ', fattura.corpo)
        fattura.tot_proforma = Number(dati_proforma.imponibile).toFixed(2).replace('.', ',')

        const acconti = await this.entityManager.query('SELECT * FROM fatture WHERE rif_proforma = ? AND tipo_fattura = "TD02"', [proforma.id])
        for (let acconto of acconti) {
          fattura.rif_acconti.push({
            descrizione: `A detrarre ft. acconto n. ${acconto.progressivo_ft_annuale}/${acconto.anno_ft} del ${format(new Date(acconto.data_fattura), 'dd/MM/yyyy')}`,
            detrazione: parseFloat((acconto.importo_ft * 100 / 122).toFixed(2)),
            cod_invio: acconto.ProgressivoInvio.toString(16), // Convert to hexadecimal
            data: acconto.data_fattura
          })
        }
        break
      case 'TD04': // Nota di credito
        const prz_tot = Math.round(-(parseFloat(model.importo_ft)) * 100) / 100;
        const prz_imponibile = Math.round(prz_tot * 100 / 122 * 100) / 100;
        const prz_imposta = Math.round((prz_tot - prz_imponibile) * 100) / 100;

        fattura.corpo.push({
          descrizione: model.descr_nota_credito,
          prezzo_unitario: Number(prz_imponibile.toFixed(2).replace('.', ',')),
          prezzo_unitario_orig: prz_imponibile,
          quantita: 1,
          totale: Number(prz_imponibile.toFixed(2).replace('.', ',')),
          totale_orig: prz_imponibile
        });
        fattura.tot_dovuto = prz_tot;
        break
      default:
        throw new NotFoundException('La risorsa richiesta non è stata trovata.');
    }

    const data = {
      cliente: cliente,
      fattura: fattura
    }
    console.log('4174___', xml)
    if (xml) {
      console.log('4176___', xml)
      console.log('XML Generato')
      await this.genPdfService.generateFattureXML('xml.template', data)
    } else {
      console.log('PDF Generato')
      await this.genPdfService.generateFatturePDF('fattura.template', data)
    }
  }

  async actionNotaCredito(data: any, userId) {
    const user = await this.validateUser(userId);

    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear garantías');
    }

    let nota_credito = null
    let fattura = null

    if (data.id !== 0) {
      [nota_credito] = await this.entityManager.query('SELECT * FROM fatture WHERE id = ?', [data.id]);
      [fattura] = await this.entityManager.query('SELECT * FROM fatture WHERE id = ?', [nota_credito.rif_ft_nota_credito]);

      nota_credito.importo_ft = - nota_credito.importo_ft;
    } else {
      [fattura] = await this.entityManager.query('SELECT * FROM fatture WHERE id = ?', [data.id]);
      nota_credito = {
        rif_proforma: fattura.rif_proforma,
        rif_ft_nota_credito: fattura.id,
        anno_ft: fattura.anno_ft,
        data_fattura: format(new Date(), 'yyyy-MM-dd'),
        tipo_fattura: 'TD04',
        descr_nota_credito: `STORNO FATTURA ${fattura.progAnnuale}`,
        importo_ft: data.importo_ft,
        incasso: 0,
        commento: '',
        data_primo_invio: '1900-01-01',
        data_inserimento: format(new Date(), 'yyyy-MM-dd'),
        contabilizza: 1,
        is_deleted: false,
      }
    }

    nota_credito.importo_ft = - data.importo_ft;
    nota_credito.descr_nota_credito = data.descr_nota_credito;

    if (data.id === 0) {
      let [prog] = await this.entityManager.query(`
        SELECT MAX(CAST(progressivo_ft_annuale AS UNSIGNED)) as prog
        FROM fatture 
        WHERE anno_ft = ? AND contabilizza = true;
      `, [nota_credito.anno_ft])

      nota_credito.progressivo_ft_annuale = prog.prog + 1
      let [prog_invio] = await this.entityManager.query(`SELECT MAX(CAST(ProgressivoInvio AS UNSIGNED)) as prog FROM fatture`)
      nota_credito.progressivo_ft_annuale = prog_invio.prog + 1
    }
    const { id, ...newval } = nota_credito
    const is_saved = await this.dataSource.createQueryBuilder()
      .insert()
      .into('fatture')
      .values(newval)
      .execute();

    if (is_saved) {
      await this.genDocsFattura(is_saved.raw?.insertId, true)
      await this.genDocsFattura(is_saved.raw?.insertId, false)
      console.log('`${userId} - ${user.role}`_', `${userId} - ${user.role}`)
      const log = {
        user: `${userId} - ${user.role}`,
        operazione: 2,
        record_table: 'fatture',
        record_id: is_saved.raw?.insertId
      }

      await this.dataSource.createQueryBuilder()
        .insert()
        .into('log')
        .values(log)
        .execute();
    }
  }

  async dataToNota(id: any) {
    const [fattura] = await this.entityManager.query('SELECT * FROM fatture WHERE id = ?', [id]);
    const [proforma] = await this.entityManager.query('SELECT * FROM proforma WHERE id = ?', [fattura.rif_proforma]);

    const tot_proforma = Number(proforma.importo) + Math.round(proforma.importo * 0.22);
    const [incassato] = await this.entityManager.query('select COALESCE(SUM(f.incasso), 0) AS incasso from fatture f where f.rif_proforma = ?', [id]);
    const [fatturato] = await this.entityManager.query('select COALESCE(SUM(f.importo_ft), 0) AS futt from fatture f where f.rif_proforma = ?', [id]);
    const { incasso } = incassato;
    const { futt } = fatturato;
    const da_saldare = Number(tot_proforma - futt).toFixed(2).replace('.', ',');
    const da_incassare = Number(tot_proforma - incasso).toFixed(2).replace('.', ',');
    const [ultima_fattura] = await this.entityManager.query('SELECT MAX(f.data_fattura) as ultima FROM fatture f WHERE f.rif_proforma = ?', [id]);
    const { ultima } = ultima_fattura;
    return { proforma, tot_proforma, incasso, futt, da_saldare, da_incassare, ultima }
  }

}


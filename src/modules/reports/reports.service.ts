import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Response } from 'express';
import * as Excel from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService {

  private meses = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

  constructor(

    @InjectEntityManager() private entityManager: EntityManager

  ) { }

  async agentiReport(id: number, mese: number, anno: number, res: Response) {

    if (mese < 1 || mese > 12 || !String(anno).match(/^\d{4}$/)) {

      throw new NotFoundException('Parametri non validi');

    }

    let agenti: any


    agenti = await this.entityManager.query('SELECT * FROM agenti WHERE id = ?',
      [id]);

    if (!agenti) {
      throw new NotFoundException('Agente non trovato');
    }

    const fileName = `${this.meses[mese - 1]} ${anno} - ${agenti.denominazione}.xlsx`;
    const meseFormatted = String(mese).padStart(2, '0');
    const concatAnnoMese = `${anno}${meseFormatted}`;

    if (parseInt(concatAnnoMese) < 202106) {
      const legacyPath = path.join(__dirname, '..', '..', 'storage', 'reports_legacy', agenti.sigla, `${anno}.${meseFormatted}.xls`);
      if (fs.existsSync(legacyPath)) {
        return res.download(legacyPath, fileName);
      } else {
        throw new NotFoundException("Il file non esiste: è possibile che l'agente non fosse attivo nella data specificata.");
      }
    }

    const proforma = this.entityManager.createQueryBuilder()
      .select('pr.*')
      .from('proforma', 'pr')
      .where(`pr.agente = ${id}`)
      .andWhere('tipo_proforma < 10')
      .andWhere(`data_proforma BETWEEN '${anno}-${meseFormatted}-01' AND LAST_DAY('${anno}-${meseFormatted}-01')`)

    // Crear y configurar el workbook de Excel
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet(`${this.meses[mese - 1]} ${anno}`);

    // Aquí iría la lógica para añadir filas y dar formato basado en el contenido HTML
    // Por ejemplo:
    worksheet.addRow(['Agente', 'Mese', 'Anno']);
    worksheet.addRow([agenti.denominazione, this.meses[mese - 1], anno]);
    // ... más filas según sea necesario

    // Ajustar anchos de columna
    worksheet.getColumn('B').width = 15;
    worksheet.getColumn('C').width = 20;
    worksheet.getColumn('D').width = 15;
    worksheet.getColumn('X').width = 15;

    const tmpPath = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath, { recursive: true });
    }

    const filePath = path.join(tmpPath, fileName);
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error al enviar el archivo:', err);
      }
      // Eliminar el archivo temporal después de enviarlo
      fs.unlinkSync(filePath);
    });


    return `This action returns all reports`;
  }


}

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as pdf from 'html-pdf';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';

@Injectable()
export class GenPdfService {
  constructor(

    private ftpService: FtpServiceService
  ) {
    // Register the if_eq helper
    Handlebars.registerHelper('if_eq', function (a, b, opts) {
      if (a == b) {
        return opts.fn(this);
      } else {
        return opts.inverse(this);
      }
    });
    Handlebars.registerHelper('if_not_eq', function (a, b, opts) {
      if (a != b) {
        return opts.fn(this);
      } else {
        return opts.inverse(this);
      }
    });

    Handlebars.registerHelper('format_number', function (number) {
      return new Intl.NumberFormat().format(number);
    });

    Handlebars.registerHelper('formatDate', function (date: any) {
      if (!date) return '';

      try {
        if (typeof date === 'string') {
          const [day, month, year] = date.split('/');
          const dateObj = new Date(`${year}-${month}-${day}`);
          return dateObj.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }

        // If date is already a Date object
        if (date instanceof Date) {
          return date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }

        return date.toString();
      } catch (error) {
        console.error('Error formatting date:', error);
        return date?.toString() || '';
      }
    });

    Handlebars.registerHelper('add', function (a: number, b: number) {
      return Number(a) + Number(b);
    });

    Handlebars.registerHelper('eq', function (a: any, b: any) {
      return a === b;
    });


    Handlebars.registerHelper('gt', function (a: any, b: any) {
      return Number(a) > Number(b);
    });

    Handlebars.registerHelper('and', function (...args) {
      // Remove the options hash from arguments
      const opts = args.pop();
      // Check if all arguments are truthy
      return args.every(Boolean);
    });

    Handlebars.registerHelper('calculateIva', function (total: number) {
      return Number(total - (total * 100 / 122)).toFixed(2);
    });

    Handlebars.registerHelper('multiply', function (a: number, b: number) {
      return Number(a) * Number(b);
    });

    Handlebars.registerHelper('divide', function (a: number, b: number) {
      return Number(a) / Number(b);
    });

    Handlebars.registerHelper('uppercase', function (str: string) {
      return str.toUpperCase();
    })

  }

  async generatePdf(templateName: string, data: any): Promise<any> {
    const startTime = Date.now();
    console.log('Generating PDF...', startTime);
    const { proforma } = data
    const imponible = proforma['imponibile']
    const id = proforma['id']
    const total = Number(imponible + (imponible * 0.22)).toFixed(2).replace('.', ',');

    data.proforma.imponible = Number(imponible).toFixed(2).replace('.', ',');
    data.proforma.total = total;

    if (proforma.scadenze > 0) {
      const numPayments = parseInt(proforma.scadenze);
      const totalAmount = parseFloat(total.replace(',', '.'));
      const amountPerPayment = (totalAmount / numPayments).toFixed(2);
      const paymentData = [];

      // Generate payment array
      for (let i = 0; i < numPayments; i++) {
        const baseDate = proforma.data.split('/');
        const paymentDate = new Date(
          parseInt(baseDate[2]),    // year
          parseInt(baseDate[1]) - 1, // month (0-based)
          parseInt(baseDate[0])     // day
        );

        // Add months instead of days
        const differitaMonths = parseInt(proforma.differita) / 30; // Convert days to months
        const periodoMonths = parseInt(proforma.periodo) / 30;     // Convert days to months

        paymentDate.setMonth(
          paymentDate.getMonth() +
          Math.floor(differitaMonths) +
          Math.floor(periodoMonths * i)
        );

        paymentData.push({
          numero: i + 1,
          importo: amountPerPayment.replace('.', ','),
          data: paymentDate.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        });
      }

      data.scadenze = paymentData;
    }

    const templatePath = path.join(__dirname, '..', '..', 'views', 'views', `${templateName}.hbs`);
    const template = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(template);

    // Add logo to data
    const logoPath = path.join(__dirname, '..', '..', 'assets', 'assets', 'images', 'logo_full.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');
    data.logo = `data:image/png;base64,${logoBase64}`;

    const html = compiledTemplate(data);

    console.log('HTML generated', Date.now() - startTime);
    console.log('GENERANDO PDF PROFORMA...');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: require('puppeteer').executablePath(),//'/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-extensions',
        '--disable-dev-shm-usage', // Helps in resource-constrained environments
        '--remote-debugging-port=9222'
      ],
      timeout: 0
    });


    try {
      const page = await browser.newPage();
      await page.setContent(html);
      const buffer = await page.pdf({ format: 'A4' });
      await browser.close();
      console.log('PDF PROFORMA GENERADO...');
      // Upload to FTP
      const remotePath = `/httpdocs/storage/prova/${id}.pdf`;
      await this.ftpService.uploadFile(buffer, remotePath);

      console.log(`PDF generation and upload took ${Date.now() - startTime}ms`);
      return 'PDF SUBIDO';
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  async generateGaranziePdf(templateName: string, data: any): Promise<any> {

    const id = data.garanzie['id'];
    const templatePath = path.join(__dirname, '..', '..', 'views', 'views', `${templateName}.hbs`);
    const template = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(template);

    // Add logo to data
    const logoPath = path.join(__dirname, '..', '..', 'assets', 'assets', 'images', 'logo_full.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    const logoGaranziePath = path.join(__dirname, '..', '..', 'assets', 'assets', 'images', 'tipi_garanzie', `${data.garanzie['tipo_garanzia']}.jpg`);
    const logoGaranzieBase64 = fs.readFileSync(logoGaranziePath, 'base64');

    data.logo = `data:image/png;base64,${logoBase64}`;
    data.logo_garanzia = `data:image/png;base64,${logoGaranzieBase64}`;

    const html = compiledTemplate(data);

    console.log('GENERANDO PDF GARANZIA...');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: require('puppeteer').executablePath(),//'/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--remote-debugging-port=9222'
      ],
      timeout: 0
    });
    const page = await browser.newPage();
    await page.setContent(html);
    const firstPdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    console.log('PDF GARANZIA GENERADO...');
    try {
      // Download second PDF from storage
      const secondPdfBuffer = await this.ftpService.getFile(`/httpdocs/storage/contratti/${data.garanzie['tipo_garanzia']}.pdf`);
      const guastiPdfBuffer = await this.ftpService.getFile(`/httpdocs/storage/moduli-home/guasti.pdf`);
      let ExtraPdfBuffer
      let ExtraPdf
      let ExtraPages

      // Merge PDFs
      const mergedPdf = await PDFDocument.create();
      const firstPdf = await PDFDocument.load(firstPdfBuffer);
      const secondPdf = await PDFDocument.load(secondPdfBuffer);
      const guastiPdf = await PDFDocument.load(guastiPdfBuffer);

      const firstPages = await mergedPdf.copyPages(firstPdf, firstPdf.getPageIndices());
      const secondPages = await mergedPdf.copyPages(secondPdf, secondPdf.getPageIndices());
      const guastiPages = await mergedPdf.copyPages(guastiPdf, guastiPdf.getPageIndices());
      firstPages.forEach(page => mergedPdf.addPage(page));
      secondPages.forEach(page => mergedPdf.addPage(page));


      if (data.garanzie['certificato_conformita'] > 0) {
        ExtraPdfBuffer = await this.ftpService.getFile(`/httpdocs/storage/contratti/Extra_DDC.pdf`);
        ExtraPdf = await PDFDocument.load(ExtraPdfBuffer);
        ExtraPages = await mergedPdf.copyPages(ExtraPdf, ExtraPdf.getPageIndices());
        ExtraPages.forEach(page => mergedPdf.addPage(page));
      }

      guastiPages.forEach(page => mergedPdf.addPage(page));
      // Save merged PDF
      const mergedPdfBuffer = Buffer.from(await mergedPdf.save());

      // Upload merged PDF
      const remotePath = `/httpdocs/storage/prova/${id}.pdf`;
      await this.ftpService.uploadFile(mergedPdfBuffer, remotePath);

      return 'PDF SUBIDO';
    } catch (error) {
      console.error('Error merging PDFs:', error);
      throw error;
    }
  }

  async generateCardSoccorsoPdf(templateName: string, data: any): Promise<Buffer> {
    const id = Number(data.card_soccorso['id']) + 3000;
    const templatePath = path.join(__dirname, '..', '..', 'views', 'views', `${templateName}.hbs`);
    const template = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(template);

    // Add logo to data
    const logoPath = path.join(__dirname, '..', '..', 'assets', 'assets', 'images', 'logo_full.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    const logoCardPath = path.join(__dirname, '..', '..', 'assets', 'assets', 'images', 'card_soccorso.png');
    const logoCardBase64 = fs.readFileSync(logoCardPath, 'base64');

    data.logo = `data:image/png;base64,${logoBase64}`;
    data.logo_soccorso = `data:image/png;base64,${logoCardBase64}`;

    const html = compiledTemplate(data);


    const browser = await puppeteer.launch({
      headless: true,
      executablePath: require('puppeteer').executablePath(),//'/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--remote-debugging-port=9222'
      ],
      timeout: 0
    });
    const page = await browser.newPage();
    await page.setContent(html);
    const firstPdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    console.log('PDF CARD SOCORRO GENERADO...');

    try {
      // Download second PDF from storage
      // const secondPdfBuffer = await this.ftpService.getFile(`/httpdocs/storage/contratti/${data.garanzie['tipo_garanzia']}.pdf`);
      // const guastiPdfBuffer = await this.ftpService.getFile(`/httpdocs/storage/moduli-home/guasti.pdf`);
      // let ExtraPdfBuffer
      // let ExtraPdf
      // let ExtraPages

      // Merge PDFs
      const mergedPdf = await PDFDocument.create();
      const firstPdf = await PDFDocument.load(firstPdfBuffer);
      // const secondPdf = await PDFDocument.load(secondPdfBuffer);
      // const guastiPdf = await PDFDocument.load(guastiPdfBuffer);

      const firstPages = await mergedPdf.copyPages(firstPdf, firstPdf.getPageIndices());
      // const secondPages = await mergedPdf.copyPages(secondPdf, secondPdf.getPageIndices());
      // const guastiPages = await mergedPdf.copyPages(guastiPdf, guastiPdf.getPageIndices());
      firstPages.forEach(page => mergedPdf.addPage(page));
      // secondPages.forEach(page => mergedPdf.addPage(page));


      // if (data.garanzie['certificato_conformita'] > 0) {
      //   ExtraPdfBuffer = await this.ftpService.getFile(`/httpdocs/storage/contratti/Extra_DDC.pdf`);
      //   ExtraPdf = await PDFDocument.load(ExtraPdfBuffer);
      //   ExtraPages = await mergedPdf.copyPages(ExtraPdf, ExtraPdf.getPageIndices());
      //   ExtraPages.forEach(page => mergedPdf.addPage(page));
      // }

      // guastiPages.forEach(page => mergedPdf.addPage(page));
      // Save merged PDF
      const mergedPdfBuffer = Buffer.from(await mergedPdf.save());

      // Upload merged PDF
      const remotePath = `/httpdocs/storage/prova/${id}.pdf`;
      await this.ftpService.uploadFile(mergedPdfBuffer, remotePath);

      return mergedPdfBuffer;
    } catch (error) {
      console.error('Error merging PDFs:', error);
      throw error;
    }
  }

  async generateFattureXML(templateName: string, data: any): Promise<Buffer> {

    // 1. Primero registramos los helpers necesarios
    Handlebars.registerHelper('formatHex', (number, padding) => {
      return number.toString(16).padStart(padding, '0').toUpperCase();
    });

    Handlebars.registerHelper('formatNumber', (number: any, decimals: number) => {
      if (typeof number !== 'number') {
        number = Number(number);
      }

      if (isNaN(number)) {
        return '0';
      }

      return number.toFixed(decimals || 2).replace('.', ',');
    });

    Handlebars.registerHelper('isPartitaIVA', (partitaIva) => {
      return partitaIva.length === 11;
    });

    Handlebars.registerHelper('inc', (value) => {
      return value + 1;
    });

    Handlebars.registerHelper('eq', (v1, v2) => {
      return v1 === v2;
    });

    Handlebars.registerHelper('and', (v1, v2) => {
      return v1 && v2;
    });

    Handlebars.registerHelper('add', (v1, v2) => {
      return v1 + v2;
    });

    Handlebars.registerHelper('multiply', (v1, v2) => {
      return v1 * v2;
    });

    Handlebars.registerHelper('subtract', (v1, v2) => {
      return v1 - v2;
    });

    // 2. Leemos y compilamos el template
    const templatePath = path.join(__dirname, '..', '..', 'views', 'views', `${templateName}.hbs`);
    const template = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(template);

    // 3. Generamos el XML
    const xml = compiledTemplate(data);

    // 4. Convertimos el XML a Buffer
    const buffer = Buffer.from(xml, 'utf8');

    // 5. Subimos al FTP
    try {
      const remotePath = `/httpdocs/storage/prova/4368.xml`;
      await this.ftpService.uploadFile(buffer, remotePath);
      return buffer;
    } catch (ftpErr) {
      throw ftpErr;
    }
  }

  async generateFatturePDF(templateName: string, data: any): Promise<any> {

    data.fattura.imponibile = (data.fattura.tot_dovuto * 100 / 122).toFixed(2).replace('.', ',');
    const templatePath = path.join(__dirname, '..', '..', 'views', 'views', `${templateName}.hbs`);
    const template = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(template);

    const logoPath = path.join(__dirname, '..', '..', 'assets', 'assets', 'images', 'logo_full.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    data.logo = `data:image/png;base64,${logoBase64}`;

    const html = compiledTemplate(data);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: require('puppeteer').executablePath(),//'/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--remote-debugging-port=9222'
      ],
      timeout: 0
    });
    const page = await browser.newPage();
    await page.setContent(html);
    const firstPdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    const remotePath = `/httpdocs/storage/prova/${data.fattura.id}.pdf`;
    try {
      await this.ftpService.uploadFile(firstPdfBuffer, remotePath);

    } catch (error) {
      console.log('error::_ ', error)
    }


    return 'Fattura generata';
  }



}

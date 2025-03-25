import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GenPdfService } from './gen-pdf.service';
import { CreateGenPdfDto } from './dto/create-gen-pdf.dto';
import { UpdateGenPdfDto } from './dto/update-gen-pdf.dto';

@Controller('gen-pdf')
export class GenPdfController {
  constructor(private readonly genPdfService: GenPdfService) { }


}

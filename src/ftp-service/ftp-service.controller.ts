import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FtpServiceService } from './ftp-service.service';
import { CreateFtpServiceDto } from './dto/create-ftp-service.dto';
import { UpdateFtpServiceDto } from './dto/update-ftp-service.dto';

@Controller('ftp-service')
export class FtpServiceController {
  constructor(
    private readonly ftpServiceService: FtpServiceService
  ) { }

  
}

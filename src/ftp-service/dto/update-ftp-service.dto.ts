import { PartialType } from '@nestjs/swagger';
import { CreateFtpServiceDto } from './create-ftp-service.dto';

export class UpdateFtpServiceDto extends PartialType(CreateFtpServiceDto) {}

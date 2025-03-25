import { Test, TestingModule } from '@nestjs/testing';
import { FtpServiceService } from './ftp-service.service';

describe('FtpServiceService', () => {
  let service: FtpServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FtpServiceService],
    }).compile();

    service = module.get<FtpServiceService>(FtpServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

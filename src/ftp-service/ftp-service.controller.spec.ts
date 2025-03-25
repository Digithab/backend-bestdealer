import { Test, TestingModule } from '@nestjs/testing';
import { FtpServiceController } from './ftp-service.controller';
import { FtpServiceService } from './ftp-service.service';

describe('FtpServiceController', () => {
  let controller: FtpServiceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FtpServiceController],
      providers: [FtpServiceService],
    }).compile();

    controller = module.get<FtpServiceController>(FtpServiceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { GenPdfService } from './gen-pdf.service';

describe('GenPdfService', () => {
  let service: GenPdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GenPdfService],
    }).compile();

    service = module.get<GenPdfService>(GenPdfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ProformaService } from './proforma.service';

describe('ProformaService', () => {
  let service: ProformaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProformaService],
    }).compile();

    service = module.get<ProformaService>(ProformaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

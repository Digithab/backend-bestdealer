import { Test, TestingModule } from '@nestjs/testing';
import { CentriConvenzionatiService } from './centri_convenzionati.service';

describe('CentriConvenzionatiService', () => {
  let service: CentriConvenzionatiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CentriConvenzionatiService],
    }).compile();

    service = module.get<CentriConvenzionatiService>(CentriConvenzionatiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

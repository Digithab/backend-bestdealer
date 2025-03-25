import { Test, TestingModule } from '@nestjs/testing';
import { OrdiniContrConsumoService } from './ordini-contr-consumo.service';

describe('OrdiniContrConsumoService', () => {
  let service: OrdiniContrConsumoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdiniContrConsumoService],
    }).compile();

    service = module.get<OrdiniContrConsumoService>(OrdiniContrConsumoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

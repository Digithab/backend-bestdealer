import { Test, TestingModule } from '@nestjs/testing';
import { OrdiniContrConsumoCardsService } from './ordini-contr-consumo-cards.service';

describe('OrdiniContrConsumoCardsService', () => {
  let service: OrdiniContrConsumoCardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdiniContrConsumoCardsService],
    }).compile();

    service = module.get<OrdiniContrConsumoCardsService>(OrdiniContrConsumoCardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

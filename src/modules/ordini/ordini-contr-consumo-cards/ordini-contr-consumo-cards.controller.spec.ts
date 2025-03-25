import { Test, TestingModule } from '@nestjs/testing';
import { OrdiniContrConsumoCardsController } from './ordini-contr-consumo-cards.controller';
import { OrdiniContrConsumoCardsService } from './ordini-contr-consumo-cards.service';

describe('OrdiniContrConsumoCardsController', () => {
  let controller: OrdiniContrConsumoCardsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdiniContrConsumoCardsController],
      providers: [OrdiniContrConsumoCardsService],
    }).compile();

    controller = module.get<OrdiniContrConsumoCardsController>(OrdiniContrConsumoCardsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

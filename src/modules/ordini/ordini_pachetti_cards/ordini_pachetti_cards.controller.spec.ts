import { Test, TestingModule } from '@nestjs/testing';
import { OrdiniPachettiCardsController } from './ordini_pachetti_cards.controller';
import { OrdiniPachettiCardsService } from './ordini_pachetti_cards.service';

describe('OrdiniPachettiCardsController', () => {
  let controller: OrdiniPachettiCardsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdiniPachettiCardsController],
      providers: [OrdiniPachettiCardsService],
    }).compile();

    controller = module.get<OrdiniPachettiCardsController>(OrdiniPachettiCardsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

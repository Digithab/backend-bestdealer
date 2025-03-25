import { Test, TestingModule } from '@nestjs/testing';
import { OrdiniPachettiCardsService } from './ordini_pachetti_cards.service';

describe('OrdiniPachettiCardsService', () => {
  let service: OrdiniPachettiCardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdiniPachettiCardsService],
    }).compile();

    service = module.get<OrdiniPachettiCardsService>(OrdiniPachettiCardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

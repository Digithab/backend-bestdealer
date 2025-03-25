import { Test, TestingModule } from '@nestjs/testing';
import { CardSoccorsoService } from './card_soccorso.service';

describe('CardSoccorsoService', () => {
  let service: CardSoccorsoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardSoccorsoService],
    }).compile();

    service = module.get<CardSoccorsoService>(CardSoccorsoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

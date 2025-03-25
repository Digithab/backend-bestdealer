import { Test, TestingModule } from '@nestjs/testing';
import { CardSoccorsoController } from './card_soccorso.controller';
import { CardSoccorsoService } from './card_soccorso.service';

describe('CardSoccorsoController', () => {
  let controller: CardSoccorsoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardSoccorsoController],
      providers: [CardSoccorsoService],
    }).compile();

    controller = module.get<CardSoccorsoController>(CardSoccorsoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

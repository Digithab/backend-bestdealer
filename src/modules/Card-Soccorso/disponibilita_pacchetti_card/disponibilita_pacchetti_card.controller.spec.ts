import { Test, TestingModule } from '@nestjs/testing';
import { DisponibilitaPacchettiCardController } from './disponibilita_pacchetti_card.controller';
import { DisponibilitaPacchettiCardService } from './disponibilita_pacchetti_card.service';

describe('DisponibilitaPacchettiCardController', () => {
  let controller: DisponibilitaPacchettiCardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisponibilitaPacchettiCardController],
      providers: [DisponibilitaPacchettiCardService],
    }).compile();

    controller = module.get<DisponibilitaPacchettiCardController>(DisponibilitaPacchettiCardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

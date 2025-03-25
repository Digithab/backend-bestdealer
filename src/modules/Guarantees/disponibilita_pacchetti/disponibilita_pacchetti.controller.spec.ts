import { Test, TestingModule } from '@nestjs/testing';
import { DisponibilitaPacchettiController } from './disponibilita_pacchetti.controller';
import { DisponibilitaPacchettiService } from './disponibilita_pacchetti.service';

describe('DisponibilitaPacchettiController', () => {
  let controller: DisponibilitaPacchettiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisponibilitaPacchettiController],
      providers: [DisponibilitaPacchettiService],
    }).compile();

    controller = module.get<DisponibilitaPacchettiController>(DisponibilitaPacchettiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

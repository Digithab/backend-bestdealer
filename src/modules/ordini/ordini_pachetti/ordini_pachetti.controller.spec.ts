import { Test, TestingModule } from '@nestjs/testing';
import { OrdiniPachettiController } from './ordini_pachetti.controller';
import { OrdiniPachettiService } from './ordini_pachetti.service';

describe('OrdiniPachettiController', () => {
  let controller: OrdiniPachettiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdiniPachettiController],
      providers: [OrdiniPachettiService],
    }).compile();

    controller = module.get<OrdiniPachettiController>(OrdiniPachettiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

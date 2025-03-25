import { Test, TestingModule } from '@nestjs/testing';
import { CondizioniGeneraliController } from './condizioni-generali.controller';
import { CondizioniGeneraliService } from './condizioni-generali.service';

describe('CondizioniGeneraliController', () => {
  let controller: CondizioniGeneraliController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CondizioniGeneraliController],
      providers: [CondizioniGeneraliService],
    }).compile();

    controller = module.get<CondizioniGeneraliController>(CondizioniGeneraliController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

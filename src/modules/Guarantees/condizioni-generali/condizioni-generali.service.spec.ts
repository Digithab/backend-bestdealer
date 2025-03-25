import { Test, TestingModule } from '@nestjs/testing';
import { CondizioniGeneraliService } from './condizioni-generali.service';

describe('CondizioniGeneraliService', () => {
  let service: CondizioniGeneraliService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CondizioniGeneraliService],
    }).compile();

    service = module.get<CondizioniGeneraliService>(CondizioniGeneraliService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

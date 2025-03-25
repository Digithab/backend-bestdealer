import { Test, TestingModule } from '@nestjs/testing';
import { OrdiniPachettiService } from './ordini_pachetti.service';

describe('OrdiniPachettiService', () => {
  let service: OrdiniPachettiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdiniPachettiService],
    }).compile();

    service = module.get<OrdiniPachettiService>(OrdiniPachettiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

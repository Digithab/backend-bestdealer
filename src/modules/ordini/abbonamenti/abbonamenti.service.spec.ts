import { Test, TestingModule } from '@nestjs/testing';
import { AbbonamentiService } from './abbonamenti.service';

describe('AbbonamentiService', () => {
  let service: AbbonamentiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbbonamentiService],
    }).compile();

    service = module.get<AbbonamentiService>(AbbonamentiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

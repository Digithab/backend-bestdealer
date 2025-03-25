import { Test, TestingModule } from '@nestjs/testing';
import { GaranzieService } from './garanzie.service';

describe('GaranzieService', () => {
  let service: GaranzieService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GaranzieService],
    }).compile();

    service = module.get<GaranzieService>(GaranzieService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

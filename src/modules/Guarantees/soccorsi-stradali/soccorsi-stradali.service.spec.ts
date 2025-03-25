import { Test, TestingModule } from '@nestjs/testing';
import { SoccorsiStradaliService } from './soccorsi-stradali.service';

describe('SoccorsiStradaliService', () => {
  let service: SoccorsiStradaliService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SoccorsiStradaliService],
    }).compile();

    service = module.get<SoccorsiStradaliService>(SoccorsiStradaliService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

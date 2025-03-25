import { Test, TestingModule } from '@nestjs/testing';
import { GuastiService } from './guasti.service';

describe('GuastiService', () => {
  let service: GuastiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GuastiService],
    }).compile();

    service = module.get<GuastiService>(GuastiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

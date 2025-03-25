import { Test, TestingModule } from '@nestjs/testing';
import { DisponibilitaPacchettiService } from './disponibilita_pacchetti.service';

describe('DisponibilitaPacchettiService', () => {
  let service: DisponibilitaPacchettiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DisponibilitaPacchettiService],
    }).compile();

    service = module.get<DisponibilitaPacchettiService>(DisponibilitaPacchettiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

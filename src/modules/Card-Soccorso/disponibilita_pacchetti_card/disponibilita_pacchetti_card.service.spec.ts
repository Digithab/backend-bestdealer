import { Test, TestingModule } from '@nestjs/testing';
import { DisponibilitaPacchettiCardService } from './disponibilita_pacchetti_card.service';

describe('DisponibilitaPacchettiCardService', () => {
  let service: DisponibilitaPacchettiCardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DisponibilitaPacchettiCardService],
    }).compile();

    service = module.get<DisponibilitaPacchettiCardService>(DisponibilitaPacchettiCardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

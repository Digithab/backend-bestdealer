import { Test, TestingModule } from '@nestjs/testing';
import { AbbonamentiController } from './abbonamenti.controller';
import { AbbonamentiService } from './abbonamenti.service';

describe('AbbonamentiController', () => {
  let controller: AbbonamentiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbbonamentiController],
      providers: [AbbonamentiService],
    }).compile();

    controller = module.get<AbbonamentiController>(AbbonamentiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

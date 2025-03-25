import { Test, TestingModule } from '@nestjs/testing';
import { GuastiController } from './guasti.controller';
import { GuastiService } from './guasti.service';

describe('GuastiController', () => {
  let controller: GuastiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GuastiController],
      providers: [GuastiService],
    }).compile();

    controller = module.get<GuastiController>(GuastiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

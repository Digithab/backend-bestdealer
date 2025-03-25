import { Test, TestingModule } from '@nestjs/testing';
import { GaranzieController } from './garanzie.controller';
import { GaranzieService } from './garanzie.service';

describe('GaranzieController', () => {
  let controller: GaranzieController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GaranzieController],
      providers: [GaranzieService],
    }).compile();

    controller = module.get<GaranzieController>(GaranzieController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CentriConvenzionatiController } from './centri_convenzionati.controller';
import { CentriConvenzionatiService } from './centri_convenzionati.service';

describe('CentriConvenzionatiController', () => {
  let controller: CentriConvenzionatiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CentriConvenzionatiController],
      providers: [CentriConvenzionatiService],
    }).compile();

    controller = module.get<CentriConvenzionatiController>(CentriConvenzionatiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

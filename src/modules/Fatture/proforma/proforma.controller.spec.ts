import { Test, TestingModule } from '@nestjs/testing';
import { ProformaController } from './proforma.controller';
import { ProformaService } from './proforma.service';

describe('ProformaController', () => {
  let controller: ProformaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProformaController],
      providers: [ProformaService],
    }).compile();

    controller = module.get<ProformaController>(ProformaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

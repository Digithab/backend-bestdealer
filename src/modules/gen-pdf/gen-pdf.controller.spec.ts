import { Test, TestingModule } from '@nestjs/testing';
import { GenPdfController } from './gen-pdf.controller';
import { GenPdfService } from './gen-pdf.service';

describe('GenPdfController', () => {
  let controller: GenPdfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GenPdfController],
      providers: [GenPdfService],
    }).compile();

    controller = module.get<GenPdfController>(GenPdfController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

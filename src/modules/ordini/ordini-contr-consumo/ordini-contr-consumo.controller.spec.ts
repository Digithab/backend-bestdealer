import { Test, TestingModule } from '@nestjs/testing';
import { OrdiniContrConsumoController } from './ordini-contr-consumo.controller';
import { OrdiniContrConsumoService } from './ordini-contr-consumo.service';

describe('OrdiniContrConsumoController', () => {
  let controller: OrdiniContrConsumoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdiniContrConsumoController],
      providers: [OrdiniContrConsumoService],
    }).compile();

    controller = module.get<OrdiniContrConsumoController>(OrdiniContrConsumoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SoccorsiStradaliController } from './soccorsi-stradali.controller';
import { SoccorsiStradaliService } from './soccorsi-stradali.service';

describe('SoccorsiStradaliController', () => {
  let controller: SoccorsiStradaliController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SoccorsiStradaliController],
      providers: [SoccorsiStradaliService],
    }).compile();

    controller = module.get<SoccorsiStradaliController>(SoccorsiStradaliController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
    let appController: AppController;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [AppService],
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe('pets', () => {
        it('should return the mock pets', () => {
            expect(appController.getPets()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Buddy' }),
                ]),
            );
        });
    });
});

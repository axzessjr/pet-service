import sharp from 'sharp';
import { processPhoto } from './photo-store';

async function makeImage(width: number, height: number, withExif: boolean) {
    let image = sharp({
        create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
    }).jpeg();
    if (withExif) {
        image = image.withExif({ IFD0: { Artist: 'phone owner', Copyright: 'private' } });
    }
    return (await image.toBuffer()).toString('base64');
}

describe('processPhoto', () => {
    it('drops EXIF metadata and shrinks large photos to 1280 px', async () => {
        const upload = await makeImage(3000, 2000, true);
        expect((await sharp(Buffer.from(upload, 'base64')).metadata()).exif).toBeDefined();

        const photo = await processPhoto(`data:image/jpeg;base64,${upload}`);
        const meta = await sharp(photo.data).metadata();
        expect(meta.format).toBe('jpeg');
        expect(meta.exif).toBeUndefined();
        expect([photo.width, photo.height]).toEqual([1280, 853]);
    });

    it('keeps small photos at their size', async () => {
        const photo = await processPhoto(await makeImage(400, 300, false));
        expect([photo.width, photo.height]).toEqual([400, 300]);
    });

    it('rejects data that is not an image', async () => {
        const text = Buffer.from('<script>alert(1)</script>').toString('base64');
        await expect(processPhoto(text)).rejects.toThrow('not a readable image');
        await expect(processPhoto('not base64 !!!')).rejects.toThrow('base64');
    });
});

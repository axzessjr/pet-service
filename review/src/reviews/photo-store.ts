import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db, GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { MONGO_DB, PhotoInfo } from '../database/mongo.module';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1280;
const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp', 'heif', 'avif'];

export interface ProcessedPhoto {
    data: Buffer;
    width: number;
    height: number;
}

// Decodes, checks, and re-encodes one upload. Re-encoding drops EXIF data
// (phone photos often carry GPS coordinates) and anything that is not image
// pixels, so only a plain JPEG is ever stored.
export async function processPhoto(upload: string): Promise<ProcessedPhoto> {
    const base64 = upload.replace(/^data:[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
        throw new BadRequestException('Photos must be base64 encoded');
    }
    const input = Buffer.from(base64, 'base64');
    if (input.length === 0) throw new BadRequestException('A photo is empty');
    if (input.length > MAX_UPLOAD_BYTES) {
        throw new BadRequestException('Each photo must be at most 5 MB');
    }

    let format: string | undefined;
    try {
        format = (await sharp(input, { limitInputPixels: 40_000_000 }).metadata()).format;
    } catch {
        throw new BadRequestException('A photo is not a readable image');
    }
    if (!format || !ACCEPTED_FORMATS.includes(format)) {
        throw new BadRequestException('Photos must be JPEG, PNG, WebP, HEIF, or AVIF');
    }

    const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate() // apply the EXIF orientation before the metadata is dropped
        .resize({
            width: MAX_EDGE,
            height: MAX_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
}

// Stores photos in MongoDB GridFS (bucket `review_photos`), which splits each
// file into chunks so it does not hit the 16 MB document limit.
@Injectable()
export class PhotoStore {
    private readonly bucket: GridFSBucket;

    constructor(@Inject(MONGO_DB) db: Db) {
        this.bucket = new GridFSBucket(db, { bucketName: 'review_photos' });
    }

    async save(uploads: string[], ownerId: number): Promise<PhotoInfo[]> {
        // Check every photo before storing any, so a bad one stores nothing.
        const processed = await Promise.all(uploads.map(processPhoto));
        const saved: PhotoInfo[] = [];
        try {
            for (const photo of processed) {
                const stream = this.bucket.openUploadStream('review-photo.jpg', {
                    metadata: {
                        contentType: 'image/jpeg',
                        ownerId,
                        width: photo.width,
                        height: photo.height,
                    },
                });
                await pipeline(Readable.from(photo.data), stream);
                saved.push({
                    id: stream.id,
                    contentType: 'image/jpeg',
                    width: photo.width,
                    height: photo.height,
                    size: photo.data.length,
                });
            }
        } catch (error) {
            await this.remove(saved.map((photo) => photo.id));
            throw error;
        }
        return saved;
    }

    async open(id: ObjectId): Promise<{ stream: Readable; length: number }> {
        const file = await this.bucket.find({ _id: id }).next();
        if (!file) throw new NotFoundException('Photo not found');
        return { stream: this.bucket.openDownloadStream(id), length: file.length };
    }

    // Best effort: a photo that is already gone is not an error.
    async remove(ids: ObjectId[]): Promise<void> {
        await Promise.all(
            ids.map((id) => this.bucket.delete(id).catch(() => undefined)),
        );
    }
}

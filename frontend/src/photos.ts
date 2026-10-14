// Review photos are shrunk in the browser before upload so a phone photo
// does not send megabytes over the network. The review service re-encodes
// them again, which also removes location data.
export const MAX_PHOTOS = 4;
const MAX_SIDE = 1280;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export type PickedPhoto = { key: string; dataUrl: string };

let nextKey = 0;

async function shrink(file: File): Promise<string> {
    // createImageBitmap applies the EXIF rotation, so photos stay upright.
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is not available');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.85);
    } finally {
        bitmap.close();
    }
}

// Returns the photos that could be read and a message for the rest.
export async function preparePhotos(
    files: File[],
): Promise<{ photos: PickedPhoto[]; error: string }> {
    const photos: PickedPhoto[] = [];
    const skipped: string[] = [];
    for (const file of files) {
        if (!file.type.startsWith('image/') || file.size > MAX_FILE_BYTES) {
            skipped.push(file.name);
            continue;
        }
        try {
            photos.push({ key: `new-${nextKey++}`, dataUrl: await shrink(file) });
        } catch {
            skipped.push(file.name);
        }
    }
    return {
        photos,
        error: skipped.length
            ? `Could not use ${skipped.join(', ')}. Choose JPEG, PNG, or WebP images under 15 MB.`
            : '',
    };
}

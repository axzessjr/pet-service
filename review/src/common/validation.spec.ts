import { validateNewReview, validateReviewChanges } from './validation';

const today = new Date().toISOString().slice(0, 10);

const VALID = {
    serviceId: 106,
    service: { title: 'Dog Bath and Brush', provider: 'Clean Paws' },
    ownerId: 1,
    pet: { id: 6, name: 'Cosmo', species: 'dog' },
    rating: 5,
    aspects: { quality: 5, value: 4 },
    title: ' Great bath ',
    comment: ' Very clean. ',
    visitedOn: today,
    tags: ['Gentle', 'clean', 'gentle '],
    wouldRecommend: true,
};

describe('validateNewReview', () => {
    it('cleans text and tags and keeps optional fields', () => {
        expect(validateNewReview(VALID)).toEqual({
            ...VALID,
            title: 'Great bath',
            comment: 'Very clean.',
            tags: ['gentle', 'clean'],
            photos: [],
        });
    });

    it('needs only service, owner, and rating', () => {
        const review = validateNewReview({
            serviceId: 101,
            service: { title: 'Walk', provider: 'John Doe' },
            ownerId: 1,
            rating: 3,
        });
        expect(review).toMatchObject({ comment: '', tags: [], photos: [] });
        expect(review.pet).toBeUndefined();
        expect(review.aspects).toBeUndefined();
    });

    it.each([
        ['rating 0', { ...VALID, rating: 0 }],
        ['rating 4.5', { ...VALID, rating: 4.5 }],
        ['unknown aspect', { ...VALID, aspects: { speed: 5 } }],
        ['aspect 6', { ...VALID, aspects: { quality: 6 } }],
        ['future visit', { ...VALID, visitedOn: '2999-01-01' }],
        ['impossible date', { ...VALID, visitedOn: '2026-02-30' }],
        ['too many tags', { ...VALID, tags: 'abcdefghi'.split('') }],
        ['wouldRecommend as text', { ...VALID, wouldRecommend: 'yes' }],
        ['five photos', { ...VALID, photos: ['a', 'b', 'c', 'd', 'e'] }],
        ['missing service snapshot', { ...VALID, service: undefined }],
        ['comment too long', { ...VALID, comment: 'x'.repeat(2001) }],
    ])('rejects %s', (_label, body) => {
        expect(() => validateNewReview(body)).toThrow();
    });
});

describe('validateReviewChanges', () => {
    it('returns only the fields that were sent, with null clearing a field', () => {
        expect(
            validateReviewChanges({ ownerId: 1, rating: 4, aspects: null }),
        ).toEqual({
            ownerId: 1,
            changes: { rating: 4, aspects: null, addPhotos: [], removePhotoIds: [] },
        });
    });

    it('rejects empty changes, unknown fields, and bad photo ids', () => {
        expect(() => validateReviewChanges({ ownerId: 1 })).toThrow(
            'Send at least one field to change',
        );
        expect(() => validateReviewChanges({ ownerId: 1, stars: 4 })).toThrow(
            'Unknown field: stars',
        );
        expect(() =>
            validateReviewChanges({ ownerId: 1, removePhotoIds: ['nope'] }),
        ).toThrow();
    });
});

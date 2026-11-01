import { CatalogService } from '../catalog/catalog.service';
import { CATALOG } from '../catalog/catalog.data';
import { PetProfileService } from '../pet-profile/pet-profile.service';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
    const pet = {
        id: 6,
        userId: 1,
        name: 'Cosmo',
        species: 'dog',
        needs: ['coat-care'],
        maxPrice: 50,
    };
    const getPetById = jest.fn();
    const profile = { getPetById } as unknown as PetProfileService;
    const fetchMock = jest.fn();
    let service: ReviewService;

    function respond(
        status: number,
        body?: unknown,
        headers?: Record<string, string>,
    ) {
        fetchMock.mockResolvedValue(
            new Response(
                body === undefined
                    ? null
                    : typeof body === 'string'
                      ? body
                      : JSON.stringify(body),
                {
                    status,
                    headers: { 'Content-Type': 'application/json', ...headers },
                },
            ),
        );
    }

    const sentBody = () =>
        JSON.parse(
            (fetchMock.mock.calls[0] as [URL, RequestInit])[1].body as string,
        ) as Record<string, unknown>;

    beforeEach(() => {
        fetchMock.mockReset();
        global.fetch = fetchMock;
        getPetById.mockReset().mockResolvedValue(pet);
        service = new ReviewService(
            {
                getCatalogItems: jest.fn().mockResolvedValue(CATALOG),
            } as unknown as CatalogService,
            profile,
        );
    });

    it('adds service and pet snapshots and ignores ones sent by the client', async () => {
        respond(201, { id: 'abc' });
        await service.createReview({
            serviceId: 106,
            ownerId: 1,
            petId: 6,
            rating: 5,
            comment: 'Great',
            service: { title: 'Fake', provider: 'Fake' },
            pet: { id: 99, name: 'Fake', species: 'cat' },
        });
        const [url] = fetchMock.mock.calls[0] as [URL];
        expect(url.pathname).toBe('/reviews');
        expect(sentBody()).toEqual({
            serviceId: 106,
            ownerId: 1,
            rating: 5,
            comment: 'Great',
            service: { title: 'Dog Bath and Brush', provider: 'Clean Paws' },
            pet: { id: 6, name: 'Cosmo', species: 'dog' },
        });
    });

    it('creates a review without a pet', async () => {
        respond(201, { id: 'abc' });
        await service.createReview({ serviceId: 102, ownerId: 1, rating: 4 });
        expect(getPetById).not.toHaveBeenCalled();
        expect(sentBody().pet).toBeUndefined();
    });

    it("rejects someone else's pet, unknown services, and other species", async () => {
        await expect(
            service.createReview({
                serviceId: 106,
                ownerId: 2,
                petId: 6,
                rating: 5,
            }),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
            service.createReview({ serviceId: 999, ownerId: 1, rating: 5 }),
        ).rejects.toMatchObject({ status: 404 });
        // 102 is cat grooming; Cosmo is a dog.
        await expect(
            service.createReview({
                serviceId: 102,
                ownerId: 1,
                petId: 6,
                rating: 5,
            }),
        ).rejects.toMatchObject({ status: 400 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('validates ids before looking anything up', async () => {
        await expect(
            service.createReview({ serviceId: 106, ownerId: '1', rating: 5 }),
        ).rejects.toMatchObject({ status: 400 });
        expect(getPetById).not.toHaveBeenCalled();
    });

    it('forwards query strings and passes 4xx errors through', async () => {
        const conflict = {
            statusCode: 409,
            message:
                'You already reviewed this service. Edit your review instead.',
            error: 'Conflict',
        };
        respond(409, conflict);
        await expect(
            service.forward('GET', '/reviews', {
                query: { serviceId: '106', ownerId: undefined },
            }),
        ).rejects.toMatchObject({ status: 409, response: conflict });
        const [url] = fetchMock.mock.calls[0] as [URL];
        expect(url.search).toBe('?serviceId=106');
    });

    it('returns undefined for 204 and 503 when the service is down', async () => {
        respond(204);
        await expect(
            service.forward('DELETE', '/reviews/x'),
        ).resolves.toBeUndefined();
        fetchMock.mockRejectedValue(new TypeError('fetch failed'));
        await expect(service.forward('GET', '/ratings')).rejects.toMatchObject({
            status: 503,
        });
    });

    it('streams photos and maps a missing photo to 404', async () => {
        respond(200, 'jpeg-bytes', {
            'Content-Type': 'image/jpeg',
            'Content-Length': '10',
        });
        const photo = await service.openPhoto('6650a1b2c3d4e5f601234567');
        expect(photo.length).toBe(10);
        const chunks: Buffer[] = [];
        for await (const chunk of photo.stream) {
            chunks.push(Buffer.from(chunk as Uint8Array));
        }
        expect(Buffer.concat(chunks).toString()).toBe('jpeg-bytes');

        respond(404, { message: 'Photo not found' });
        await expect(
            service.openPhoto('6650a1b2c3d4e5f601234567'),
        ).rejects.toMatchObject({
            status: 404,
        });
    });
});

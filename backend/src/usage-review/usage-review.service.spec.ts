import { CatalogService } from '../catalog/catalog.service';
import { PetProfileService } from '../pet-profile/pet-profile.service';
import { UsageReviewService } from './usage-review.service';

describe('UsageReviewService', () => {
    const pet = {
        id: 1,
        userId: 7,
        name: 'Max',
        species: 'dog',
        needs: ['exercise'],
        maxPrice: 45,
    };
    const profile = {
        getPetById: jest.fn(),
    } as unknown as PetProfileService;
    const fetchMock = jest.fn();
    let service: UsageReviewService;

    function respond(status: number, body?: unknown) {
        fetchMock.mockResolvedValue(
            new Response(body === undefined ? null : JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
    }

    beforeEach(() => {
        fetchMock.mockReset();
        global.fetch = fetchMock;
        (profile.getPetById as jest.Mock).mockReset().mockResolvedValue(pet);
        service = new UsageReviewService(new CatalogService(), profile);
    });

    it('books a catalog service with a snapshot of its details', async () => {
        respond(201, { id: 3, status: 'booked' });
        await expect(
            service.createUsage({ ownerId: 7, petId: 1, serviceId: 101 }),
        ).resolves.toEqual({ id: 3, status: 'booked' });

        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(url.pathname).toBe('/usages');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body as string)).toEqual({
            ownerId: 7,
            petId: 1,
            serviceId: 101,
            serviceTitle: 'Neighborhood Dog Walk',
            provider: 'John Doe',
            price: 15,
        });
    });

    it("rejects someone else's pet without calling the service", async () => {
        await expect(
            service.createUsage({ ownerId: 8, petId: 1, serviceId: 101 }),
        ).rejects.toMatchObject({ status: 404 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects unknown services and services for another species', async () => {
        await expect(
            service.createUsage({ ownerId: 7, petId: 1, serviceId: 999 }),
        ).rejects.toMatchObject({ status: 404 });
        // 102 is cat grooming; the pet is a dog.
        await expect(
            service.createUsage({ ownerId: 7, petId: 1, serviceId: 102 }),
        ).rejects.toMatchObject({ status: 400 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('validates IDs before looking anything up', async () => {
        await expect(
            service.createUsage({ ownerId: '7', petId: 1, serviceId: 101 }),
        ).rejects.toMatchObject({ status: 400 });
        expect(profile.getPetById).not.toHaveBeenCalled();
    });

    it('forwards query strings and passes 4xx errors through', async () => {
        const conflict = {
            statusCode: 409,
            message: 'Usage 3 already has a review',
            error: 'Conflict',
        };
        respond(409, conflict);
        await expect(
            service.forward('GET', '/reviews', {
                query: { serviceId: '101', ownerId: undefined },
            }),
        ).rejects.toMatchObject({ status: 409, response: conflict });
        const [url] = fetchMock.mock.calls[0] as [URL];
        expect(url.search).toBe('?serviceId=101');
    });

    it('returns undefined for 204 responses', async () => {
        respond(204);
        await expect(
            service.forward('DELETE', '/reviews/1', {
                query: { ownerId: '7' },
            }),
        ).resolves.toBeUndefined();
    });

    it('returns 503 when the service is down or fails', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'));
        await expect(service.forward('GET', '/ratings')).rejects.toMatchObject({
            status: 503,
        });
        respond(500, { message: 'boom' });
        await expect(service.forward('GET', '/ratings')).rejects.toMatchObject({
            status: 503,
        });
    });
});

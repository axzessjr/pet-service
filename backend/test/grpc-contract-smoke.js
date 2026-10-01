// Run while the Python recommender is listening; exercises the Nest gRPC client.
const assert = require('node:assert/strict');
const path = require('node:path');
const { ClientProxyFactory, Transport } = require('@nestjs/microservices');
const { firstValueFrom } = require('rxjs');

async function main() {
    const client = ClientProxyFactory.create({
        transport: Transport.GRPC,
        options: {
            package: 'recommendation',
            protoPath: path.resolve(__dirname, '../../proto/recommendation.proto'),
            url: process.env.RECOMMENDATION_GRPC_URL ?? 'localhost:50051',
        },
    });
    const engine = client.getService('RecommendationEngine');
    let id;
    try {
        const input = {
            pet: { species: 'cat', needs: ['play'], maxPrice: 30 },
            services: [{ id: 101, species: ['cat'], tags: ['play'], price: 20 }],
            limit: 5,
        };
        const created = await firstValueFrom(
            engine.createRecommendation({ petId: 7, input }),
        );
        id = created.id;
        assert.equal(created.petId, 7);
        assert.equal(created.matches[0].serviceId, 101);
        assert.equal(
            (await firstValueFrom(engine.getRecommendation({ id }))).id,
            id,
        );
        assert.equal(
            (await firstValueFrom(engine.listRecommendations({ petId: 7 })))
                .recommendations.some((record) => record.id === id),
            true,
        );
        const updated = await firstValueFrom(
            engine.updateRecommendation({ id, petId: 7, input: { ...input, limit: 1 } }),
        );
        assert.equal(updated.limit, 1);
        assert.equal((await firstValueFrom(engine.deleteRecommendation({ id }))).deleted, true);
        id = undefined;
        console.log('NestJS to Python gRPC CRUD smoke passed');
    } finally {
        if (id) {
            await firstValueFrom(engine.deleteRecommendation({ id })).catch(() => undefined);
        }
        client.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

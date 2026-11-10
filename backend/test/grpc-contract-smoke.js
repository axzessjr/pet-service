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
    try {
        const response = await firstValueFrom(
            engine.recommend({
                pet: { species: 'cat', needs: ['play'], maxPrice: 30 },
                services: [
                    { id: 101, species: ['cat'], tags: ['play'], price: 20 },
                    { id: 102, species: ['dog'], tags: ['play'], price: 10 },
                ],
                limit: 5,
            }),
        );
        assert.deepEqual(
            response.matches.map((match) => match.serviceId),
            [101],
        );
        console.log('NestJS to Python gRPC Recommend smoke passed');
    } finally {
        client.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

import {
    Injectable,
    Logger,
    OnApplicationBootstrap,
    RequestMethod,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { UPSTREAM_METADATA, UPSTREAMS, UpstreamName } from './upstreams';

// Routes without an upstream are answered by the gateway itself.
export const LOCAL_SERVICE = 'backend';

export interface GatewayServiceInfo {
    name: string;
    protocol: string;
    url: string;
}

export interface GatewayRoute {
    method: string;
    path: string;
    service: string;
    protocol: string;
}

function joinPath(...parts: string[]): string {
    const path = parts
        .flatMap((part) => part.split('/'))
        .filter(Boolean)
        .join('/');
    return `/${path}`;
}

function asList(value: string | string[] | undefined): string[] {
    if (value === undefined) return [''];
    return Array.isArray(value) ? value : [value];
}

// Builds the services and routes table from the controllers Nest has
// registered, so it always matches what the gateway actually serves.
@Injectable()
export class GatewayService implements OnApplicationBootstrap {
    private readonly logger = new Logger('Gateway');
    private routeTable?: GatewayRoute[];

    constructor(
        private readonly discovery: DiscoveryService,
        private readonly scanner: MetadataScanner,
        private readonly reflector: Reflector,
    ) {}

    services(): GatewayServiceInfo[] {
        return [
            ...Object.entries(UPSTREAMS).map(([name, { protocol, url }]) => ({
                name,
                protocol,
                url,
            })),
            { name: LOCAL_SERVICE, protocol: 'in-process', url: '-' },
        ];
    }

    routes(): GatewayRoute[] {
        this.routeTable ??= this.discoverRoutes();
        return this.routeTable;
    }

    onApplicationBootstrap(): void {
        const routes = this.routes();
        const width = Math.max(...routes.map((route) => route.path.length));
        this.logger.log('Services:');
        for (const { name, protocol, url } of this.services()) {
            this.logger.log(
                `  ${name.padEnd(12)} ${protocol.padEnd(10)} ${url}`,
            );
        }
        this.logger.log(`Routes (${routes.length}):`);
        for (const { method, path, service, protocol } of routes) {
            this.logger.log(
                `  ${method.padEnd(6)} ${path.padEnd(width)}  -> ${service} (${protocol})`,
            );
        }
    }

    private discoverRoutes(): GatewayRoute[] {
        const routes: GatewayRoute[] = [];
        for (const wrapper of this.discovery.getControllers()) {
            const controller = wrapper.metatype;
            if (!controller) continue;
            const upstream = this.reflector.get<UpstreamName | undefined>(
                UPSTREAM_METADATA,
                controller,
            );
            const service = upstream ?? LOCAL_SERVICE;
            const protocol = upstream
                ? UPSTREAMS[upstream].protocol
                : 'in-process';
            const prototype = controller.prototype as Record<
                string,
                (...args: unknown[]) => unknown
            >;
            const bases = asList(
                this.reflector.get<string | string[]>(
                    PATH_METADATA,
                    controller,
                ),
            );
            for (const name of this.scanner.getAllMethodNames(prototype)) {
                const handler = prototype[name];
                const method = this.reflector.get<RequestMethod | undefined>(
                    METHOD_METADATA,
                    handler,
                );
                if (method === undefined) continue;
                const paths = asList(
                    this.reflector.get<string | string[]>(
                        PATH_METADATA,
                        handler,
                    ),
                );
                for (const base of bases) {
                    for (const path of paths) {
                        routes.push({
                            method: RequestMethod[method],
                            path: joinPath(base, path),
                            service,
                            protocol,
                        });
                    }
                }
            }
        }
        return routes.sort(
            (a, b) =>
                a.path.localeCompare(b.path) ||
                a.method.localeCompare(b.method),
        );
    }
}

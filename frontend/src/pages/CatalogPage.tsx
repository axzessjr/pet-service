import { useState, useEffect } from 'react';
import type { CatalogItem } from '../types';

async function loadCatalog(signal?: AbortSignal): Promise<CatalogItem[]> {
    const response = await fetch('/api/catalog', { signal });
    if (!response.ok) throw new Error('Could not load services.');
    return response.json() as Promise<CatalogItem[]>;
}

export function CatalogPage() {
    const [services, setServices] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchServices = () => {
        setLoading(true);
        loadCatalog()
            .then(setServices)
            .catch((error) => {
                console.error('Error fetching catalog services:', error);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const controller = new AbortController();
        loadCatalog(controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) setServices(data);
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    console.error('Error fetching catalog services:', error);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, []);

    return (
        <div>
            {/* We use Flexbox here to put the title and the button on the same line */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 m-0">
                    <i className="fa-solid fa-store mr-2 text-blue-500"></i>
                    Available Services
                </h2>

                {/* 3. The Refresh Button! */}
                <button
                    onClick={fetchServices}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 cursor-pointer border-0"
                >
                    <i
                        className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}
                    ></i>
                    Refresh
                </button>
            </div>

            {loading ? (
                <p className="text-gray-500 italic">Loading services...</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {
                        services.map((service) => (
                            <div key={service.id} className="py-2 px-4 border rounded-xl flex flex-col justify-between">
                                <div>
                                    <strong className="text-lg text-gray-800">
                                        {service.title}
                                    </strong>
                                    <div className="text-sm text-gray-600 mt-1">
                                        By {service.provider}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        {service.category} · {service.description}
                                    </div>
                                </div>
                                <strong className="text-green-600 text-xl font-bold mt-4">
                                    ${service.price}
                                </strong>
                            </div>
                        ))
                    }
                </div>
            )}
        </div>
    );
}

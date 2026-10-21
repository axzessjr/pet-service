import type { ReactNode } from 'react';

export function EmptyState({
    icon,
    title,
    body,
    action,
    compact = false,
}: {
    icon: string;
    title: string;
    body: string;
    action?: ReactNode;
    // For narrow spaces such as the results panel: no border, less padding.
    compact?: boolean;
}) {
    return (
        <div
            className={
                compact
                    ? 'px-4 py-8 text-center'
                    : 'rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center'
            }
        >
            <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-xl text-teal-700">
                <i className={`fa-solid ${icon}`}></i>
            </span>
            <p className="mb-1 mt-4 text-lg font-bold text-gray-900">{title}</p>
            <p className="mx-auto mb-5 mt-0 max-w-md text-gray-600">{body}</p>
            {action}
        </div>
    );
}

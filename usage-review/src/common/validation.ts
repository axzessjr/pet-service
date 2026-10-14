import { BadRequestException } from '@nestjs/common';

const MAX_INT = 2147483647;

export function positiveInteger(value: unknown, name: string): number {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value <= 0 ||
        value > MAX_INT
    ) {
        throw new BadRequestException(`${name} must be a positive integer`);
    }
    return value;
}

// Query strings arrive as text, e.g. ?ownerId=1
export function positiveIntegerParam(value: unknown, name: string): number {
    if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) {
        throw new BadRequestException(`${name} must be a positive integer`);
    }
    return positiveInteger(Number(value), name);
}

export function rating(value: unknown): number {
    if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 5
    ) {
        throw new BadRequestException('rating must be an integer from 1 to 5');
    }
    return value;
}

export function comment(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
        throw new BadRequestException('comment must be text');
    }
    const trimmed = value.trim();
    if (trimmed.length > 2000) {
        throw new BadRequestException(
            'comment must be at most 2000 characters',
        );
    }
    return trimmed;
}

export function nonEmptyText(value: unknown, name: string): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) throw new BadRequestException(`${name} is required`);
    return trimmed;
}

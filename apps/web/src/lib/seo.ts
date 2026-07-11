export const SITE_URL = 'https://imovi.app.br';
export const SITE_NAME = 'imovi';

export function absoluteUrl(path = '/'): string {
  return new URL(path, SITE_URL).toString();
}

/** Slug estável e legível para URLs em português. */
export function seoSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

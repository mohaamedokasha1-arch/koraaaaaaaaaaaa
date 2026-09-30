import type { Metadata } from 'next';
import { locales, type Locale } from '@/i18n/locales';

/**
 * Central SEO helper.
 *
 * Why it exists: the locale layout used to declare one canonical for every
 * page under `/{locale}`, so every sub-page (live, leagues, teams, matches…)
 * told Google "my canonical is the locale home". That is the classic
 * template-wide canonical bug: it de-indexes the whole site. Every page now
 * declares its own absolute, self-referencing canonical plus reciprocal
 * hreflang (with x-default), from one place.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** Path without locale prefix, always starting with '/' and without trailing slash. */
export function localePath(locale: Locale, path = '/'): string {
  if (!path || path === '/') return `/${locale}`;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean.replace(/\/+$/, '')}`;
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Reciprocal language alternates for a locale-independent path. */
export function languageAlternates(path = '/'): Record<string, string> {
  const clean = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const alternates: Record<string, string> = {};
  for (const l of locales) alternates[l] = absoluteUrl(`/${l}${clean}`);
  // x-default points at the Arabic (project default) version.
  alternates['x-default'] = absoluteUrl(`/ar${clean}`);
  return alternates;
}

export interface PageMetadataInput {
  locale: Locale;
  /** Path WITHOUT the locale prefix, e.g. '/leagues/EGY' or '/'. */
  path?: string;
  title: string;
  description: string;
  /** Set false for thin/duplicated variants (filters, empty views…). */
  indexable?: boolean;
  type?: 'website' | 'article';
  image?: string | null;
  /** Locale-independent extra keywords are intentionally NOT emitted (no stuffing). */
}

export function pageMetadata({
  locale,
  path = '/',
  title,
  description,
  indexable = true,
  type = 'website',
  image,
}: PageMetadataInput): Metadata {
  const canonical = absoluteUrl(localePath(locale, path));
  const ogImage = image ? { url: image, alt: title } : undefined;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(path),
    },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type,
      title,
      description,
      url: canonical,
      siteName: 'KoraScore',
      locale: locale === 'ar' ? 'ar_EG' : 'en_GB',
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage.url] : undefined,
    },
  };
}

/** BreadcrumbList that mirrors the visible breadcrumbs exactly (spec §13). */
export function breadcrumbJsonLd(items: { name: string; path: string }[], locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(localePath(locale, item.path)),
    })),
  };
}

/** Site-level entity graph — emitted once, from the locale layout. */
export function siteJsonLd(locale: Locale, siteName: string, searchPath = '/') {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: siteName,
        url: SITE_URL,
        inLanguage: locale,
        // Search is a real, working in-site feature, so exposing it is honest.
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/${locale}${searchPath}?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: siteName,
        url: SITE_URL,
        logo: absoluteUrl('/icon.svg'),
      },
    ],
  };
}

/** Trim a generated description, never letting it overflow SERP limits. */
export function clip(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

#!/usr/bin/env node
/**
 * Live SEO audit against a deployed origin — the machine-checkable half of
 * docs/SEO-CHECKLIST.md.
 *
 *   node scripts/seo-check.mjs https://korascore.com
 *   node scripts/seo-check.mjs https://korascore.com --paths=/ar,/ar/live,/ar/leagues/EGY
 *   node scripts/seo-check.mjs http://localhost:3000 --local   (relaxes https/host checks)
 *
 * What it actually proves, per URL: HTTP status, self-referencing absolute
 * canonical, reciprocal hreflang + x-default, indexability, title/description,
 * og:image, JSON-LD and a server-rendered H1. Plus robots.txt (does not block
 * /_next/static, declares the sitemap), the sitemap index and a sample of its
 * children, `noindex` on /api, and the www → apex redirect.
 *
 * It never modifies anything and never authenticates; a 401/403 from a
 * Deployment-Protected preview is reported as a failure, which is exactly
 * what you want to know before pointing Google at it.
 */
import { checkPage, checkRobotsTxt, checkSitemapIndex, parseSitemap, summarize } from '../src/lib/pure/seoCheck.ts';

const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const DEFAULT_PATHS = [
  '/ar',
  '/en',
  '/ar/live',
  '/ar/today',
  '/ar/results',
  '/ar/upcoming',
  '/ar/leagues',
  '/ar/leagues/EGY',
  '/ar/standings',
  '/ar/top-scorers',
  '/ar/teams',
];

const args = process.argv.slice(2);
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const has = (name) => args.includes(`--${name}`);
const originArg = args.find((a) => !a.startsWith('--'));

if (!originArg) {
  console.error('usage: node scripts/seo-check.mjs <origin> [--paths=/ar,/en] [--local] [--sample=3]');
  process.exit(2);
}

const ORIGIN = originArg.replace(/\/+$/, '');
const LOCAL = has('local') || /localhost|127\.0\.0\.1/.test(ORIGIN);
const SAMPLE = Number(flag('sample') ?? 3);
const PATHS = (flag('paths') ?? DEFAULT_PATHS.join(',')).split(',').map((p) => p.trim()).filter(Boolean);

const results = [];

function section(title) {
  results.push({ kind: 'section', title });
}

function record(label, checks) {
  results.push({ kind: 'row', label, checks });
}

async function fetchRaw(path, { method = 'GET', redirect = 'follow' } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`${ORIGIN}${path}`, {
      method,
      redirect,
      headers: { 'user-agent': GOOGLEBOT, accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(20_000),
    });
    const headers = Object.fromEntries([...res.headers.entries()]);
    const type = headers['content-type'] ?? '';
    const body = type.includes('html') || type.includes('xml') || type.includes('json') || type.includes('text')
      ? await res.text()
      : '';
    return { ok: true, status: res.status, headers, body, ms: Date.now() - started, url: res.url };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error), ms: Date.now() - started };
  }
}

// ── 1. pages ────────────────────────────────────────────────────────────────
section('Pages');
for (const path of PATHS) {
  const res = await fetchRaw(path);
  if (!res.ok) {
    record(path, [{ id: 'network', label: 'reachable', status: 'fail', detail: res.error }]);
    continue;
  }
  record(path, checkPage({
    url: `${ORIGIN}${path}`,
    finalUrl: res.url || `${ORIGIN}${path}`,
    status: res.status,
    headers: res.headers,
    html: res.body,
  }));
}

// A path that cannot exist must answer a real 404, not a 200 "empty" page.
{
  const probe = `/ar/__seo-check-does-not-exist-${Date.now()}`;
  const res = await fetchRaw(probe);
  record(probe, res.ok
    ? checkPage({
        url: `${ORIGIN}${probe}`,
        finalUrl: res.url || `${ORIGIN}${probe}`,
        status: res.status,
        headers: res.headers,
        html: res.body,
        expectedStatus: 404,
        expectNoindex: true,
      })
    : [{ id: 'network', label: 'reachable', status: 'fail', detail: res.error }]);
}

// ── 2. robots.txt ───────────────────────────────────────────────────────────
section('robots.txt');
{
  const res = await fetchRaw('/robots.txt');
  if (!res.ok || res.status !== 200) {
    record('/robots.txt', [{ id: 'robots.status', label: 'served', status: 'fail', detail: res.ok ? `HTTP ${res.status}` : res.error }]);
  } else {
    record('/robots.txt', checkRobotsTxt(res.body, ORIGIN));
  }
}

// ── 3. sitemap ──────────────────────────────────────────────────────────────
section('sitemap.xml');
{
  const res = await fetchRaw('/sitemap.xml');
  if (!res.ok || res.status !== 200) {
    record('/sitemap.xml', [{ id: 'sitemap.status', label: 'served', status: 'fail', detail: res.ok ? `HTTP ${res.status}` : res.error }]);
  } else {
    record('/sitemap.xml', checkSitemapIndex(res.body, ORIGIN));
    const index = parseSitemap(res.body);
    const children = index.kind === 'sitemapindex' ? index.locs : [];
    for (const child of children) {
      const childRes = await fetchRaw(child.replace(ORIGIN, '') || '/sitemap.xml');
      if (!childRes.ok || childRes.status !== 200) {
        record(child, [{ id: 'sitemap.child', label: 'child served', status: 'fail', detail: childRes.ok ? `HTTP ${childRes.status}` : childRes.error }]);
        continue;
      }
      const parsed = parseSitemap(childRes.body);
      record(`${child} (${parsed.locs.length} urls)`, [
        {
          id: 'sitemap.child',
          label: 'child is valid XML',
          status: parsed.malformed ? 'fail' : 'pass',
          detail: parsed.malformed ? 'unparsable' : `${parsed.kind} · ${parsed.locs.length} urls`,
        },
      ]);
    }

    // Sample real URLs: a sitemap entry that 404s or canonicalises elsewhere
    // is worse than no entry at all.
    const sampleUrls = [];
    for (const child of children) {
      const childRes = await fetchRaw(child.replace(ORIGIN, '') || '/sitemap.xml');
      if (!childRes.ok) continue;
      const parsed = parseSitemap(childRes.body);
      sampleUrls.push(...parsed.locs.filter((loc) => loc.startsWith(ORIGIN)).slice(0, SAMPLE));
      if (sampleUrls.length >= SAMPLE) break;
    }
    for (const url of sampleUrls.slice(0, SAMPLE)) {
      const res2 = await fetchRaw(url.replace(ORIGIN, ''));
      record(url.replace(ORIGIN, ''), res2.ok
        ? checkPage({
            url,
            finalUrl: res2.url || url,
            status: res2.status,
            headers: res2.headers,
            html: res2.body,
          })
        : [{ id: 'network', label: 'reachable', status: 'fail', detail: res2.error }]);
    }
  }
}

// ── 4. api + host hygiene ───────────────────────────────────────────────────
section('Headers & host');
{
  const res = await fetchRaw('/api/health');
  const tag = res.ok ? (res.headers['x-robots-tag'] ?? '') : '';
  record('/api/health', [{
    id: 'api.noindex',
    label: 'X-Robots-Tag: noindex on /api',
    status: tag.includes('noindex') ? 'pass' : 'fail',
    detail: res.ok ? `status ${res.status} · ${tag || 'header missing'}` : res.error,
  }]);

  const home = await fetchRaw('/ar');
  if (home.ok) {
    const tag2 = home.headers['x-robots-tag'] ?? '';
    record('/ar (headers)', [{
      id: 'html.noindex-header',
      label: 'no X-Robots-Tag on HTML',
      status: tag2.includes('noindex') ? 'fail' : 'pass',
      detail: tag2 || 'none (correct for production)',
    }]);
  }
}

if (!LOCAL) {
  const host = new URL(ORIGIN).hostname;
  const www = host.startsWith('www.') ? ORIGIN.replace('www.', '') : ORIGIN.replace('://', '://www.');
  const res = await fetch(www, { redirect: 'manual', headers: { 'user-agent': GOOGLEBOT } }).catch((e) => ({ ok: false, error: e }));
  const target = res.ok ? res.headers?.get('location') : null;
  const status = res.ok ? res.status : 0;
  const redirected = status >= 300 && status < 400 && target && new URL(target, www).origin === new URL(ORIGIN).origin;
  record(`${new URL(www).hostname} → ${new URL(ORIGIN).hostname}`, [{
    id: 'host.canonical',
    label: 'one host redirects to the other',
    status: redirected ? 'pass' : 'warn',
    detail: redirected ? `${status} → ${target}` : `no redirect (status ${status}); set it in Vercel → Domains`,
  }]);
}

// ── 5. report ───────────────────────────────────────────────────────────────
const GLYPH = { pass: '✔', warn: '!', fail: '✘' };
const COLOR = { pass: '\x1b[32m', warn: '\x1b[33m', fail: '\x1b[31m' };
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

const all = results.filter((r) => r.kind === 'row').flatMap((r) => r.checks);
const totals = summarize(all);

console.log(`\nSEO check — ${ORIGIN}${LOCAL ? '  (local mode)' : ''}\n`);
for (const row of results) {
  if (row.kind === 'section') {
    console.log(`\n\x1b[1m${row.title}\x1b[0m`);
    continue;
  }
  const { pass, fail } = summarize(row.checks);
  const mark = fail > 0 ? 'fail' : pass === row.checks.length ? 'pass' : 'warn';
  console.log(`  ${COLOR[mark]}${GLYPH[mark]}${RESET} ${row.label}`);
  for (const check of row.checks) {
    console.log(`      ${COLOR[check.status]}${GLYPH[check.status]}${RESET} ${DIM}${check.label}:${RESET} ${check.detail}`);
  }
}

console.log(
  `\n${COLOR.pass}${totals.pass} pass${RESET} · ${COLOR.warn}${totals.warn} warn${RESET} · ${COLOR.fail}${totals.fail} fail${RESET}\n`,
);
process.exit(totals.fail > 0 ? 1 : 0);

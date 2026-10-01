import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ serviceWorkers: 'block' });
const fixture = (scenario = 'en-live') => `http://127.0.0.1:3101/interactive/cards/${scenario}`;
const image = (scenario: string) => `http://127.0.0.1:3101/interactive/image/${scenario}`;
async function openCard(page: Page, scenario = 'en-live') {
  await page.goto(fixture(scenario));
  await page.getByRole('button', { name: scenario.startsWith('ar') ? 'شارك بطاقة المباراة' : 'Share a match card', exact: true }).click();
  await expect(page.getByTestId('share-card-preview')).toBeVisible();
}
async function previewSvg(page: Page) {
  const src = await page.getByTestId('share-card-preview').getAttribute('src');
  return decodeURIComponent(src!.split(',', 2)[1]);
}
function dimensions(buffer: Buffer) {
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(buffer.readUInt32BE(16)).toBe(1200); expect(buffer.readUInt32BE(20)).toBe(630);
}

test('card renderer/canvas code is deferred until intent, with no API/third-party asset requests', async ({ page }) => {
  const scripts: Promise<string>[] = [], calls: string[] = [];
  page.on('response', response => { if (/\/_next\/static\/.*\.js(?:\?|$)/.test(response.url())) scripts.push(response.text().catch(() => '')); });
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/') || url.hostname === 'unlicensed.test') calls.push(request.url()); });
  await page.goto(fixture()); await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('share-card-panel')).toHaveCount(0);
  expect((await Promise.all(scripts)).join('\n')).not.toContain('image_decode');
  expect((await Promise.all(scripts)).join('\n')).not.toContain('Standalone, bounded, text-only SVG');
  await page.getByRole('button', { name: 'Share a match card', exact: true }).click();
  await expect(page.getByTestId('share-card-preview')).toBeVisible();
  expect(calls).toEqual([]);
});
test('source-status card variants show real score, fixture time or cancellation without invented stats', async ({ page }) => {
  for (const [scenario, phrase] of [['en-finished', 'Match result'], ['en-live', 'Match now'], ['en-fixture', 'Match fixture'], ['en-cancelled', 'Cancelled']]) {
    await openCard(page, scenario);
    const svg = await previewSvg(page); expect(svg).toContain(phrase);
    expect(svg).not.toContain('unlicensed.test'); expect(svg).not.toContain('possession');
    if (scenario.includes('fixture') || scenario.includes('cancelled')) expect(svg).not.toMatch(/x="550" y="315"[^>]*>4<\/text>/);
  }
});
test('downloaded Arabic SVG is self-contained XML with source/still-image disclosures', async ({ page }, testInfo) => {
  await openCard(page, 'ar-finished');
  const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'تنزيل SVG', exact: true }).click();
  const download = await promise; const path = testInfo.outputPath('card.svg'); await download.saveAs(path);
  const svg = await readFile(path, 'utf8');
  expect(download.suggestedFilename()).toMatch(/\.svg$/); expect(svg).toContain('الأهلي'); expect(svg).toContain('الزمالك');
  expect(svg).toContain('football-data.org'); expect(svg).toContain('18:45 UTC'); expect(svg).not.toMatch(/<image\b|<script|<foreignObject|\bhref=/);
  expect(await page.evaluate(svg => new DOMParser().parseFromString(svg, 'image/svg+xml').querySelectorAll('parsererror').length, svg)).toBe(0);
});
test('client PNG export genuinely rasterizes the Arabic SVG at1200×630', async ({ page }, testInfo) => {
  await openCard(page, 'ar-finished');
  const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'تنزيل PNG', exact: true }).click();
  const download = await promise; const path = testInfo.outputPath('arabic-card.png'); await download.saveAs(path);
  dimensions(await readFile(path)); await expect(page.getByText('تم تجهيز ملف التنزيل.', { exact: true })).toBeVisible();
});
test('copy uses the actual public origin and no query/cookies/private preferences', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openCard(page);
  await page.getByRole('button', { name: 'Copy match link', exact: true }).click();
  await expect(page.getByText('Match link copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://127.0.0.1:3101/en/matches/fd~990001');
  await expect(page.getByRole('textbox', { name: 'Copy match link' })).toHaveValue('http://127.0.0.1:3101/en/matches/fd~990001');
});
test('clipboard failure discloses failure and provides a manually selectable real link', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }); });
  await openCard(page);
  await page.getByRole('button', { name: 'Copy match link', exact: true }).click();
  await expect(page.getByText('Automatic copying failed. Select and copy the link below.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Copy match link' })).toHaveAttribute('readonly', '');
});
test('new source score/time props refresh the preview without an extra network poll', async ({ page }) => {
  await openCard(page, 'ar-live'); expect(await previewSvg(page)).toMatch(/x="650" y="315"[^>]*>4<\/text>/);
  await page.getByRole('button', { name: 'Supply fresh score' }).click();
  expect(await previewSvg(page)).toMatch(/x="650" y="315"[^>]*>5<\/text>/);
  expect(await previewSvg(page)).toContain('18:46 UTC');
});
test('native link-share cancellation is not reported as successful sending', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('cancelled', 'AbortError'); } }); });
  await openCard(page);
  await page.getByRole('button', { name: 'Share link', exact: true }).click();
  await expect(page.getByText('Sharing cancelled; the site sent nothing.', { exact: true })).toBeVisible();
});
test('image native share prepares first, passes a real PNG file, and invalidates after source refresh', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { (window as unknown as { sharedFile: { type: string; size: number } }).sharedFile = { type: data.files![0].type, size: data.files![0].size }; } });
  });
  await openCard(page);
  await page.getByRole('button', { name: 'Prepare image to share', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share image', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Share image', exact: true }).click();
  const file = await page.evaluate(() => (window as unknown as { sharedFile: { type: string; size: number } }).sharedFile);
  expect(file.type).toBe('image/png'); expect(file.size).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Supply fresh score' }).click();
  await expect(page.getByRole('button', { name: 'Prepare image to share', exact: true })).toBeVisible();
});
test('canvas failure stays honest and SVG remains an available fallback', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
  await openCard(page);
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  await expect(page.getByText('Could not prepare the image. Try SVG or copy the link.', { exact: true })).toBeVisible();
  const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download SVG', exact: true }).click();
  expect((await promise).suggestedFilename()).toMatch(/\.svg$/);
});
test('social actions are ordinary safe links and unsupported native sharing is not faked', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
  await openCard(page);
  await expect(page.getByRole('button', { name: 'Share link', exact: true })).toHaveCount(0);
  const facebook = page.getByRole('link', { name: 'Facebook', exact: true });
  await expect(facebook).toHaveAttribute('rel', 'noopener noreferrer'); await expect(facebook).toHaveAttribute('target', '_blank');
  expect(new URL((await facebook.getAttribute('href'))!).searchParams.get('u')).toBe('http://127.0.0.1:3101/en/matches/fd~990001');
});
test('OG route rasterizes genuine PNGs with bounded cache and correct metadata headers', async ({ request }) => {
  for (const scenario of ['en-live', 'ar-finished', 'ar-fixture']) {
    const response = await request.get(image(scenario)); expect(response.status()).toBe(200); dimensions(await response.body());
    expect(response.headers()['content-type']).toContain('image/png'); expect(response.headers()['x-robots-tag']).toContain('noindex');
    expect(response.headers()['x-kora-snapshot-at']).toBe('2026-10-02T18:45:00.000Z');
    expect(response.headers()['cache-control']).toContain(scenario.includes('finished') ? 's-maxage=300' : 's-maxage=30');
  }
});
test('stale and unavailable source handling stays explicit in preview and server images', async ({ page, request }) => {
  await openCard(page, 'en-stale'); expect(await previewSvg(page)).toContain('Cached data');
  await expect(page.getByTestId('share-card-preview')).toHaveAttribute('alt', /Cached data/);
  expect((await request.get(image('ar-stale'))).headers()['cache-control']).toBe('no-store');
  const missing = await request.get(image('en-unavailable')); expect(missing.status()).toBe(404); expect(missing.headers()['cache-control']).toBe('no-store');
  expect((await request.get(image('en-live') + '?source=http://127.0.0.1')).status()).toBe(400);
});
test('card preview/actions are bounded at320px/landscape/desktop in AR/EN without runtime errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['ar', 'en']) for (const [width, height] of [[320, 568], [667, 375], [1280, 720]]) {
    await page.setViewportSize({ width, height }); await openCard(page, `${locale}-finished`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('deferred card loading/export survives slow3G-like latency and4× CPU without adding API polling', async ({ page }) => {
  test.setTimeout(65_000);
  await page.goto(fixture());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.getByRole('button', { name: 'Share a match card', exact: true }).click();
  await expect(page.getByTestId('share-card-preview')).toBeVisible({ timeout: 45_000 });
  const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  expect((await promise).suggestedFilename()).toMatch(/\.png$/);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

test('actual production match page composes story/cards and preserves match-specific SEO metadata', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['ar', 'en']) for (const [width, height] of [[320, 568], [667, 375], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`http://127.0.0.1:3101/interactive/match/${locale}-finished`);
    await expect(page.getByTestId('match-story')).toBeVisible(); await expect(page.getByTestId('share-card-gate')).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`/${locale}/matches/fd~990002/share-image$`));
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', new RegExp(`/${locale}/matches/fd~990002/share-image$`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${locale}/matches/fd~990002$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: locale === 'ar' ? 'شارك بطاقة المباراة' : 'Share a match card', exact: true }).click();
    await expect(page.getByTestId('share-card-preview')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('production match JSON-LD cannot be broken out of by a hostile source team name', async ({ page }) => {
  await page.goto('http://127.0.0.1:3101/interactive/match/en-unsafe-finished');
  expect(await page.evaluate(() => (window as unknown as { fixtureInjected?: boolean }).fixtureInjected)).toBeUndefined();
  const json = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent!)));
  expect(json.find(node => node['@type'] === 'SportsEvent').homeTeam.name).toContain('</script><script>');
});

test('unsupported OG glyphs retain native files and safe default metadata, never a fake translated name', async ({ page, request }) => {
  await openCard(page, 'en-nonlatin');
  await expect(page.getByText('Some characters are outside the OG font. The link uses the default site image; file preview/download uses your device’s fonts.', { exact: true })).toBeVisible();
  expect(await previewSvg(page)).toContain('東京 FC');
  await page.goto('http://127.0.0.1:3101/interactive/match/en-nonlatin-finished');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-default.png$/);
  expect((await request.get(image('en-nonlatin'))).status()).toBe(503);
});

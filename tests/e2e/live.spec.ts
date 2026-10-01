import { test, expect, type Page, type Route } from '@playwright/test';
import { makeFixture } from './fixture-app/fixture';

const fixtureUrl = 'http://127.0.0.1:3101';

async function prepare(page: Page, mode = 'youtube', allFail = false) {
  const catalog = makeFixture(mode);
  const scheduled = catalog.matches[0].status === 'scheduled';
  if (mode === 'hls') await page.addInitScript(() => {
    // Exercise hls.js even on Chromium releases with native HLS support.
    const native = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type: string) { return type === 'application/vnd.apple.mpegurl' ? '' : native.call(this, type); };
  });
  await page.route('**/live/catalog.json', (route) => route.fulfill({ json: catalog }));
  await page.route('**/api/matches/live', (route) => route.fulfill({ json: { matches: [{
    id: 'test~fixture', status: scheduled ? 'scheduled' : 'live', minute: scheduled ? null : 30,
    home: { id: 'test~home', name: 'Test home' }, away: { id: 'test~away', name: 'Test away' },
    score: { home: scheduled ? null : 1, away: scheduled ? null : 0 }, events: scheduled ? [] : [{ type: 'goal', minute: 20, extraMinute: null, teamId: 'test~home', player: 'Test player', assist: null, playerIn: null, playerOut: null }],
  }], stale: false, fetchedAt: '2026-10-01T19:00:00Z' } }));
  await page.route('**/api/live/report', (route) => route.fulfill({ status: 503, json: { error: 'reporting_not_configured' } }));
  await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Test provider</title>' }));
  await page.addInitScript((failAll) => {
    window.YT = { Player: class {
      timer: ReturnType<typeof setTimeout>;
      constructor(element: HTMLElement, readonly options: { events: { onError: (event: { data: number }) => void; onReady: (event: { target: { playVideo: () => void; destroy: () => void } }) => void; onStateChange: (event: { data: number }) => void } }) {
        this.timer = setTimeout(() => {
          if (failAll || (element instanceof HTMLIFrameElement && element.src.includes('testVideo01'))) options.events.onError({ data: 100 });
          else options.events.onReady({ target: this });
        }, 60);
      }
      playVideo() { this.options.events.onStateChange({ data: 1 }); }
      destroy() { clearTimeout(this.timer); }
    } };
  }, allFail);
  return catalog;
}

test('clean aliases enter the centre; Arabic is RTL; empty catalogue is honest and legal pages work', async ({ page, request }) => {
  const response = await request.get('/live', { maxRedirects: 0 });
  expect(response.status()).toBe(307); expect(response.headers().location).toContain('/ar/watch');
  await page.goto('/ar/watch');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز البث المباشر', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'لا توجد بثوث منشورة بعد' })).toBeVisible();
  await expect(page.locator('iframe, video')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/en/watch/disclaimer');
  await expect(page.getByRole('heading', { name: 'Broadcast disclaimer' })).toBeVisible();
  await page.goto('/en/watch/copyright');
  await expect(page.getByText('The operator has not configured a rights-contact email yet. A production launch must configure one.')).toBeVisible();
  expect((await request.get('/ar/watch/admin')).status()).toBe(404);
  expect((await request.get('/ar/watch/not-a-real-match')).status()).toBe(404);
});

test('mobile centre has no horizontal overflow and language switching preserves the route', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/ar/watch');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Switch to English' }).click();
  await expect(page).toHaveURL(/\/en\/watch$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('click-to-load makes zero provider requests before consent; YouTube error falls back and stores actual success', async ({ page }) => {
  await prepare(page);
  const mediaRequests: string[] = [];
  page.on('request', (request) => { if (/youtube|twitch|scorebat/.test(request.url())) mediaRequests.push(request.url()); });
  await page.goto(fixtureUrl);
  await expect(page.getByTestId('load-player')).toBeVisible(); expect(mediaRequests).toHaveLength(0);
  await expect(page.locator('iframe, video')).toHaveCount(0);
  await page.getByTestId('load-player').click();
  await expect(page.getByRole('button', { name: /Test source two/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Test source two/ })).toContainText('Playback confirmed');
  expect(await page.evaluate(() => localStorage.getItem('kora:live:last-success:test~fixture'))).toBe('second');
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  await expect(page.locator('iframe')).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await page.getByRole('button', { name: 'Report a problem' }).click();
  await expect(page.getByText('Reporting needs the durable database to be configured. Try the next source instead.')).toBeVisible();
});

test('all failures stop after two attempts per source and an explicit retry starts a new round', async ({ page }) => {
  await prepare(page, 'youtube', true); await page.goto(fixtureUrl); await page.getByTestId('load-player').click();
  await expect(page.getByRole('heading', { name: 'No source could be played' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Where to watch?' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No source could be played' })).toBeVisible();
});

test('HLS attempts one media recovery, then switches on another fatal error', async ({ page }) => {
  await prepare(page, 'hls'); await page.goto(`${fixtureUrl}/?mode=hls`); await page.getByTestId('load-player').click();
  await expect(page.getByRole('button', { name: /Test source two/ })).toContainText('Playback confirmed');
  expect(await page.evaluate(() => window.__liveHlsRecoveries)).toBe(1);
});

test('a generic iframe times out at twelve seconds without assuming cross-origin playback', async ({ page }) => {
  test.setTimeout(40_000);
  await prepare(page, 'iframe'); await page.route('https://www.scorebat.com/**', () => { /* deliberately pending */ });
  await page.goto(`${fixtureUrl}/?mode=iframe`); await page.getByTestId('load-player').click();
  await expect(page.getByRole('button', { name: /Test iframe/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Test source two/ })).toContainText('Playback confirmed', { timeout: 20_000 });
});

test('iframe load is not a green playback claim; user confirmation is required', async ({ page }) => {
  await prepare(page, 'iframe'); await page.route('https://www.scorebat.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Loaded iframe only</title>' }));
  await page.goto(`${fixtureUrl}/?mode=iframe`); await page.getByTestId('load-player').click();
  await expect(page.getByRole('button', { name: /Test iframe/ })).toContainText('Not verified');
  await page.getByRole('button', { name: 'It works', exact: true }).click();
  await expect(page.getByRole('button', { name: /Test iframe/ })).toContainText('Playback confirmed');
});

test('external-only coverage does not load a player; existing score-card watch links are siblings, not nested anchors', async ({ page }) => {
  await prepare(page, 'external'); await page.goto(`${fixtureUrl}/?mode=external`);
  await expect(page.getByTestId('load-player')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Watch on the official platform' })).toHaveAttribute('href', 'https://www.beinsports.com/');
  await expect(page.getByTestId('existing-score-card').getByRole('link', { name: 'Watch', exact: true })).toBeVisible();
  await expect(page.locator('a a')).toHaveCount(0);
});

test('scheduled match exports a UTC calendar reminder; match tabs support keyboard navigation', async ({ page }) => {
  await prepare(page, 'scheduled'); await page.goto(`${fixtureUrl}/?mode=scheduled`);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Remind me · add to calendar' }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('match-test~fixture.ics');
  const events = page.getByRole('tab', { name: 'Events', exact: true }); await events.focus(); await events.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Standings', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('competition and team filters operate on the CDN catalogue without new API endpoints', async ({ page }) => {
  const catalog = makeFixture('youtube');
  catalog.matches.push({ ...catalog.matches[0], matchId: 'test~other', home: { id: 'test~third', name: 'Test third', crest: null }, away: { id: 'test~fourth', name: 'Test fourth', crest: null }, competition: { id: 'OTHER', name: 'Other test competition', code: null }, status: 'scheduled', startsAt: '2099-01-01T18:00:00Z' });
  await page.route('**/live/catalog.json', (route) => route.fulfill({ json: catalog }));
  await page.goto('/en/watch');
  await expect(page.locator('article')).toHaveCount(2);
  await page.getByLabel('Competition', { exact: true }).selectOption('OTHER');
  await expect(page.locator('article')).toHaveCount(1); await expect(page.locator('article')).toContainText('Test third');
  await page.getByLabel('Team', { exact: true }).selectOption('test~home');
  await expect(page.getByText('No matches match your filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click(); await expect(page.locator('article')).toHaveCount(2);
});

test('catalogue and scores polling stop in a hidden tab and resume on visibility', async ({ page }) => {
  await page.clock.install(); await prepare(page);
  let reads = 0; page.on('request', (request) => { if (/\/live\/catalog\.json$|\/api\/matches\/live$/.test(request.url())) reads++; });
  await page.goto(fixtureUrl); await expect(page.getByRole('tabpanel', { name: 'Events' })).toContainText('Test player');
  const before = reads;
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(90_000); expect(reads).toBe(before);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => reads).toBeGreaterThan(before);
});

test('broadcast display follows the existing zone cookie while calendar timestamps stay UTC', async ({ page, context }) => {
  await context.addCookies([{ name: 'KORA_TZ', value: 'UTC', domain: '127.0.0.1', path: '/' }]);
  await prepare(page, 'scheduled'); await page.goto(`${fixtureUrl}?mode=scheduled`);
  await expect(page.locator('time')).toContainText('18:00');
  await page.evaluate(() => { document.cookie = 'KORA_TZ=Asia%2FDubai; path=/'; window.dispatchEvent(new Event('kora:timezone-change')); });
  await expect(page.locator('time')).toContainText('22:00');
});


test('temporary source suppression expires with unchanged JSON, restoring the player and score-card watch link', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T19:00:00Z') });
  await prepare(page, 'temporary'); await page.goto(`${fixtureUrl}/?mode=temporary`);
  await expect(page.getByTestId('existing-score-card').getByRole('link', { name: 'Watch', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('load-player')).toHaveCount(0);
  await page.clock.fastForward(65_000);
  await expect(page.getByTestId('load-player')).toBeVisible();
  await expect(page.getByTestId('existing-score-card').getByRole('link', { name: 'Watch', exact: true })).toBeVisible();
});

test('hub source counts advance without a changed catalogue or a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T19:00:00Z') });
  const catalog = makeFixture('temporary');
  await page.route('**/live/catalog.json', (route) => route.fulfill({ json: catalog }));
  await page.goto('/en/watch');
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText('0 Broadcast sources');
  await page.clock.fastForward(65_000);
  await expect(page.locator('article')).toContainText('2 Broadcast sources');
});

test('elapsed source end times unmount playback and remove expired watch links with unchanged JSON', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T19:00:00Z') });
  await prepare(page, 'expiring'); await page.goto(`${fixtureUrl}/?mode=expiring`);
  await page.getByTestId('load-player').click();
  await expect(page.getByRole('button', { name: /Test source two/ })).toContainText('Playback confirmed');
  await expect(page.getByTestId('existing-score-card').getByRole('link', { name: 'Watch', exact: true })).toBeVisible();
  await page.clock.fastForward(65_000);
  await expect(page.getByTestId('stream-player')).toHaveCount(0);
  await expect(page.locator('iframe, video')).toHaveCount(0);
  await expect(page.getByTestId('existing-score-card').getByRole('link', { name: 'Watch', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Watch on the official platform' })).toHaveCount(0);
});

test('error retries do not fetch in hidden or offline tabs; visibility and reconnect resume reads', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T19:00:00Z') });
  await prepare(page);
  let reads = 0;
  const failRead = (route: Route) => { reads++; return route.fulfill({ status: 503, json: { error: 'Synthetic test outage' } }); };
  await page.route('**/live/catalog.json', failRead);
  await page.route('**/api/matches/live', failRead);
  await page.goto(fixtureUrl);
  await expect(page.getByText('The broadcast catalogue could not be refreshed. Showing the last available catalogue.')).toBeVisible();
  const beforeHidden = reads;
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(180_000); expect(reads).toBe(beforeHidden);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => reads).toBeGreaterThan(beforeHidden);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline')); });
  const beforeOffline = reads;
  await page.clock.fastForward(180_000); expect(reads).toBe(beforeOffline);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); window.dispatchEvent(new Event('online')); });
  await expect.poll(() => reads).toBeGreaterThan(beforeOffline);
});

test('a malformed HTTP 200 report response never claims that a report was received', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/live/report', (route) => route.fulfill({ json: { accepted: false, duplicate: false } }));
  await page.goto(fixtureUrl); await page.getByTestId('load-player').click();
  await expect(page.getByRole('button', { name: /Test source two/ })).toContainText('Playback confirmed');
  await page.getByRole('button', { name: 'Report a problem' }).click();
  await expect(page.getByText('The report could not be sent. Please try again later.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report received' })).toHaveCount(0);
});


test('a confirmed live score suppresses an outdated scheduled countdown without inventing a stream', async ({ page }) => {
  await prepare(page, 'scheduled');
  await page.route('**/api/matches/live', (route) => route.fulfill({ json: { matches: [{
    id: 'test~fixture', status: 'live', minute: 5,
    home: { id: 'test~home', name: 'Test home' }, away: { id: 'test~away', name: 'Test away' },
    score: { home: 0, away: 0 }, events: [],
  }], stale: false, fetchedAt: '2026-10-01T19:00:00Z' } }));
  await page.goto(`${fixtureUrl}/?mode=scheduled`);
  await expect(page.getByText('Live now · 5′')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remind me · add to calendar' })).toHaveCount(0);
  await expect(page.getByTestId('load-player')).toHaveCount(0);
});


test('hub fixtures are ordered by actual kickoff time, not the text of different UTC offsets', async ({ page }) => {
  const catalog = makeFixture('scheduled');
  catalog.matches = [
    { ...catalog.matches[0], matchId: 'test~later', home: { id: 'test~late', name: 'Later kickoff', crest: null }, startsAt: '2026-10-01T18:00:00Z' },
    { ...catalog.matches[0], matchId: 'test~earlier', home: { id: 'test~early', name: 'Earlier kickoff', crest: null }, startsAt: '2026-10-01T20:00:00+03:00' },
  ];
  await page.route('**/live/catalog.json', (route) => route.fulfill({ json: catalog }));
  await page.goto('/en/watch');
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.locator('article').first()).toContainText('Earlier kickoff');
  await expect(page.locator('article').nth(1)).toContainText('Later kickoff');
});

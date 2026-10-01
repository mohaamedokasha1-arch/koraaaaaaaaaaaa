import { test, expect, type Page } from '@playwright/test';
import en from '../../src/i18n/en.json';
import { PREFERENCES_KEY, parseFavorite, type Preferences } from '../../src/features/personalization/lib/preferences';
import type { DashboardResponse } from '../../src/features/personalization/lib/dashboard';

// All synthetic score/news payloads below are browser-test interceptions only.
// Production pages/feeds never import this file or the isolated fixture app.
test.use({ serviceWorkers: 'block' });
const NOW = '2026-10-01T19:00:00Z';
const ahly = parseFavorite({ kind: 'team', id: 'team:al-ahly-eg', slug: 'al-ahly-eg', name: 'Al Ahly', nameAr: 'الأهلي', country: 'Egypt', leagueCode: 'EGY' })!;
const prefs: Preferences = { version: 1, dashboardEnabled: true, favorites: [ahly] };
function dashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    version: 1, day: '2026-10-01', timeZone: 'Africa/Cairo', coverage: 'complete', liveAvailable: true,
    fetchedAt: NOW, news: [], newsStatus: 'disabled', newsStale: false, newsFetchedAt: null,
    live: [], results: [], fixtures: [{
      stale: false, fetchedAt: NOW, source: 'fd', match: {
        id: 'fd~990001', provider: 'fd', providerId: '990001', utcDate: '2026-10-01T20:00:00Z', status: 'scheduled', minute: null,
        home: { id: 'fd~57', name: 'Isolated test home', shortName: null, crest: null }, away: { id: 'fd~999', name: 'Isolated test away', shortName: null, crest: null },
        score: { home: null, away: null }, league: { id: 'fd~PL', code: 'PL', name: 'Isolated test competition', emblem: null, country: null },
        matchday: null, venue: null, referee: null, events: [], lastUpdated: NOW,
      },
    }], ...overrides,
  };
}
async function seed(page: Page, value: unknown = prefs) {
  await page.clock.install({ time: Date.parse(NOW) });
  await page.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); }, { key: PREFERENCES_KEY, value });
}
async function localPreferences(page: Page): Promise<Preferences> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCES_KEY);
}

test('a visitor without interests keeps the public home and makes zero dashboard requests', async ({ page }) => {
  let calls = 0;
  const scripts: Promise<string>[] = [];
  page.on('request', (request) => { if (request.url().includes('/api/personalization/dashboard')) calls++; });
  page.on('response', (response) => { if (/\/_next\/static\/.*\.js(?:\?|$)/.test(response.url())) scripts.push(response.text().catch(() => '')); });
  await page.goto('/en'); await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: en.home.heroTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'My space', exact: true })).toBeVisible();
  await expect(page.getByTestId('personal-dashboard')).toHaveCount(0);
  expect(calls).toBe(0);
  // The SWR/renderer/API fetch code lives in a deferred chunk, not the public JS.
  expect((await Promise.all(scripts)).join('\n')).not.toContain('invalid_dashboard');
});

test('guest favourites persist across reload and private metadata is explicit', async ({ page, request }) => {
  const response = await request.get('/en/profile');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['x-robots-tag']).toContain('noindex');
  const html = await response.text();
  expect(html).toMatch(/name="robots" content="noindex, follow"/);
  expect(html).toContain('/en/profile');
  await page.goto('/en/profile');
  await expect(page.getByRole('button', { name: 'Follow Al Ahly', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Follow Al Ahly', exact: true }).click();
  await page.getByRole('tab', { name: 'Competitions', exact: true }).click();
  await page.getByRole('button', { name: 'Follow Egyptian Premier League', exact: true }).click();
  expect((await localPreferences(page)).favorites.map((entry) => entry.id)).toEqual(['team:al-ahly-eg', 'league:egy']);
  await page.reload();
  const interests = page.getByRole('region', { name: 'Your interests', exact: true });
  await expect(interests.getByRole('button', { name: 'Unfollow Al Ahly', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(interests.getByRole('button', { name: 'Unfollow Egyptian Premier League', exact: true })).toBeVisible();
  await expect(page.getByText('Cloud accounts and multi-device sync are not activated.', { exact: false })).toBeVisible();
  await expect(page.locator('input[type=password], input[type=email]')).toHaveCount(0);
});

test('team/competition pages use the same store and never nest follow buttons in links', async ({ page }) => {
  await page.goto('/en/teams/al-ahly-eg');
  await page.getByRole('button', { name: 'Follow Al Ahly', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unfollow Al Ahly', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/en/leagues/EGY');
  await page.getByRole('button', { name: 'Follow Egyptian Premier League', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unfollow Egyptian Premier League', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/en/leagues');
  await expect(page.getByRole('button', { name: 'Unfollow Egyptian Premier League', exact: true })).toBeVisible();
  await expect(page.locator('a button')).toHaveCount(0);
  expect((await localPreferences(page)).favorites.length).toBe(2);
});

test('catalogue aliases work in Arabic/English and tabs support keyboard navigation', async ({ page }) => {
  await page.goto('/en/profile');
  await page.getByRole('searchbox', { name: 'Search the catalogue' }).fill('المارد الأحمر');
  await expect(page.getByRole('button', { name: 'Follow Al Ahly', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Follow Zamalek', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Teams', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Competitions', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Competitions', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('searchbox', { name: 'Search the catalogue' }).fill('الدوري المصري');
  await expect(page.getByRole('button', { name: 'Follow Egyptian Premier League', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Players', exact: true }).click();
  await expect(page.getByText('Players appear here only after real squad or scorer data has been loaded.', { exact: false })).toBeVisible();
});

test('the lazy dashboard requests references only and leaves the full public home visible', async ({ page }) => {
  await seed(page);
  let selection: unknown;
  await page.route('**/api/personalization/dashboard', (route) => { selection = route.request().postDataJSON(); return route.fulfill({ json: dashboard() }); });
  await page.goto('/en');
  const panel = page.getByTestId('personal-dashboard');
  await expect(panel.getByRole('heading', { name: 'Your personal dashboard', exact: true })).toBeVisible();
  await expect(panel.getByText('Isolated test home', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: en.home.heroTitle, exact: true })).toBeVisible();
  expect(selection).toEqual({ teams: [{ id: 'team:al-ahly-eg', providerId: null }], leagues: [] });
  expect(JSON.stringify(selection)).not.toContain('Al Ahly');
  await expect(panel.getByText('News appears only when the operator enables licensed feeds.', { exact: false })).toBeVisible();
});

test('switching personalisation off keeps favourites, stops reads, and can be re-enabled', async ({ page }) => {
  await seed(page); let calls = 0;
  await page.route('**/api/personalization/dashboard', (route) => { calls++; return route.fulfill({ json: dashboard() }); });
  await page.goto('/en');
  await page.getByTestId('personal-dashboard').getByRole('button', { name: 'Switch off', exact: true }).click();
  await expect(page.getByTestId('personal-dashboard')).toHaveCount(0);
  expect((await localPreferences(page)).dashboardEnabled).toBe(false);
  expect((await localPreferences(page)).favorites.length).toBe(1);
  const before = calls; await page.reload(); await page.waitForLoadState('networkidle');
  expect(calls).toBe(before);
  await page.goto('/en/profile');
  const checkbox = page.getByRole('checkbox', { name: 'Personalise the home page', exact: true });
  await expect(checkbox).toBeEnabled(); await expect(checkbox).not.toBeChecked(); await checkbox.check();
  await page.goto('/en'); await expect(page.getByTestId('personal-dashboard').getByText('Isolated test home', { exact: true })).toBeVisible();
  expect(calls).toBeGreaterThan(before);
});

test('last-interest removal restores the public-only home without a new data read', async ({ page }) => {
  await seed(page); let calls = 0;
  await page.route('**/api/personalization/dashboard', (route) => { calls++; return route.fulfill({ json: dashboard() }); });
  await page.goto('/en/profile');
  await page.getByRole('region', { name: 'Your interests', exact: true }).getByRole('button', { name: 'Unfollow Al Ahly', exact: true }).click();
  expect((await localPreferences(page)).favorites.length).toBe(0);
  await page.goto('/en'); await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('personal-dashboard')).toHaveCount(0); expect(calls).toBe(0);
});

test('same-browser tabs receive follow/unfollow changes without account synchronisation', async ({ page, context }) => {
  await page.goto('/en/profile');
  const other = await context.newPage(); await other.goto('/en/profile');
  await page.getByRole('button', { name: 'Follow Al Ahly', exact: true }).click();
  const otherInterests = other.getByRole('region', { name: 'Your interests', exact: true });
  await expect(otherInterests.getByRole('button', { name: 'Unfollow Al Ahly', exact: true })).toBeVisible();
  await otherInterests.getByRole('button', { name: 'Unfollow Al Ahly', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your interests', exact: true }).getByRole('heading', { name: 'Make it your game', exact: true })).toBeVisible();
  await other.close();
});

test('blocked storage keeps temporary follows honest and does not survive reload', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('blocked', 'SecurityError'); } }));
  await page.goto('/en/profile');
  await expect(page.getByText('Browser storage is unavailable or full.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Follow Al Ahly', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your interests', exact: true }).getByRole('button', { name: 'Unfollow Al Ahly', exact: true })).toBeVisible();
  await expect(page.getByText('Kept for this visit only.', { exact: true })).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: 'News', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/news$/);
  await page.getByRole('banner').getByRole('link', { name: 'My space', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your interests', exact: true }).getByRole('button', { name: 'Unfollow Al Ahly', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Make it your game', exact: true })).toBeVisible();
});

test('future local documents are preserved until explicit confirmed reset', async ({ page }) => {
  await seed(page, { ...prefs, version: 2 });
  await page.goto('/en/profile');
  await expect(page.getByText('These preferences were saved by a newer version.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Follow Al Ahly', exact: true })).toBeDisabled();
  expect((await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCES_KEY)).version).toBe(2);
  await page.getByRole('button', { name: 'Clear local preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCES_KEY)).version).toBe(2);
  await page.getByRole('button', { name: 'Clear local preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, clear preferences', exact: true }).click();
  await expect(page.getByText('Local preferences cleared.', { exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), PREFERENCES_KEY)).toBeNull();
  await expect(page.getByRole('button', { name: 'Follow Al Ahly', exact: true })).toBeEnabled();
});

test('mobile/desktop profile, global time zone and language switch preserve stored interests', async ({ page }) => {
  await seed(page); await page.setViewportSize({ width: 390, height: 667 }); await page.goto('/en/profile');
  const menuToggle = page.getByRole('banner').getByRole('button', { name: en.nav.home, exact: true });
  await menuToggle.click();
  const menu = page.getByRole('navigation', { name: 'Mobile', exact: true });
  await expect(menu.getByRole('link', { name: 'My space', exact: true })).toHaveCount(1);
  await expect(menu.getByRole('link', { name: 'News', exact: true })).toHaveCount(1);
  expect(await menu.evaluate((node) => node.getBoundingClientRect().bottom <= window.innerHeight)).toBe(true);
  await menuToggle.click();
  const picker = page.getByRole('complementary').getByRole('combobox', { name: 'Choose time zone' });
  await picker.selectOption('Asia/Tokyo');
  await expect(picker).toHaveValue('Asia/Tokyo');
  await page.getByRole('banner').getByRole('link', { name: 'التبديل إلى العربية', exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/profile$/); await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('region', { name: 'اهتماماتك', exact: true }).getByRole('button', { name: 'إلغاء متابعة الأهلي', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary').getByRole('combobox', { name: 'اختيار المنطقة الزمنية' })).toHaveValue('Asia/Tokyo');
  for (const width of [320, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `RTL overflow at ${width}`).toBe(true);
    expect(await page.getByRole('heading', { name: 'كرة القدم على طريقتك', exact: true }).evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(150);
  }
  await page.getByRole('banner').getByRole('link', { name: 'Switch to English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  for (const width of [320, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `LTR overflow at ${width}`).toBe(true);
  }
});

test('malformed HTTP 200 and temporary failures render recoverable errors, not fabricated scores', async ({ page }) => {
  await seed(page); const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  let requests = 0;
  await page.route('**/api/personalization/dashboard', (route) => { requests++; return route.fulfill({ json: requests === 1 ? {} : dashboard() }); });
  await page.goto('/en');
  await expect(page.getByText('Football data is unavailable right now.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: en.home.heroTitle, exact: true })).toBeVisible();
  await page.getByTestId('personal-dashboard').getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByTestId('personal-dashboard').getByText('Isolated test home', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('old/offline snapshots are labelled and hidden/offline dashboards do not poll', async ({ page }) => {
  await seed(page); let calls = 0;
  const old = dashboard(); old.fixtures[0].fetchedAt = '2026-10-01T18:00:00Z';
  await page.route('**/api/personalization/dashboard', (route) => { calls++; return route.fulfill({ json: old }); });
  await page.goto('/en');
  await expect(page.getByTestId('personal-dashboard').getByText('Saved snapshot — not a fresh live update.', { exact: false })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  const before = calls; await page.clock.fastForward(180_000); expect(calls).toBe(before);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('offline')); });
  await expect(page.getByText('You are offline. Any visible results are saved snapshots, not live updates.', { exact: true })).toBeVisible();
  await page.clock.fastForward(180_000); expect(calls).toBe(before);
});

test('player source fixtures require actual IDs and scope the same number by provider', async ({ page }) => {
  await page.goto('http://127.0.0.1:3101/personalization');
  await page.getByRole('row', { name: /Test player with ID/ }).getByRole('button', { name: 'Follow Test player with ID', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Squad source', exact: true }).getByRole('button', { name: 'Unfollow Test player with ID', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('row', { name: /Test player without ID/ }).getByRole('button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Follow Test player other provider', exact: true }).click();
  expect((await localPreferences(page)).favorites.map((entry) => entry.id)).toEqual(['player:fd~101', 'player:af~101']);
  await expect(page.locator('#player-fd-101')).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Unfollow Test player other provider', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Unfollow Test player other provider', exact: true })).toBeVisible();
  }
});

test('API validates origin/type/size/IDs, stays no-store, and personal pages are absent from sitemaps', async ({ request }) => {
  const path = '/api/personalization/dashboard';
  const bad = await request.post(path, { data: { teams: [], leagues: ['INVENTED'] } });
  expect(bad.status()).toBe(400); expect(bad.headers()['cache-control']).toContain('no-store'); expect(bad.headers()['x-robots-tag']).toContain('noindex');
  expect((await request.post(path, { data: '{}', headers: { 'Content-Type': 'text/plain' } })).status()).toBe(415);
  expect((await request.post(path, { data: ' '.repeat(17_000), headers: { 'Content-Type': 'application/json' } })).status()).toBe(413);
  expect((await request.post(path, { data: { teams: [], leagues: ['PL'] }, headers: { Origin: 'https://evil.example' } })).status()).toBe(403);
  const staticSitemap = await (await request.get('/sitemaps/static.xml')).text();
  expect(staticSitemap).not.toContain('/profile'); expect(staticSitemap).not.toContain('/privacy'); expect(staticSitemap).not.toContain('/search');
  const privacy = await request.get('/en/privacy'); expect(privacy.status()).toBe(200); expect(await privacy.text()).toContain('noindex, follow');
  expect((await request.get('/manifest.webmanifest')).status()).toBe(200);
  const sw = await (await request.get('/sw.js')).text(); expect(sw).toContain("url.pathname.startsWith('/api/')");
});

test('new read endpoint does not grant a crawler user-agent a rate-limit bypass', async ({ request }) => {
  const responses = [];
  for (let index = 0; index < 21; index++) responses.push(await request.post('/api/personalization/dashboard', { data: { teams: [], leagues: [] }, headers: { 'User-Agent': 'Googlebot', 'X-Forwarded-For': '203.0.113.240' } }));
  expect(responses.slice(0, 20).every((response) => response.status() === 400)).toBe(true);
  expect(responses[20].status()).toBe(429); expect(Number(responses[20].headers()['retry-after'])).toBeGreaterThan(0);
  expect(responses[20].headers()['cache-control']).toBe('private, no-store');
  expect(responses[20].headers()['x-robots-tag']).toContain('noindex');
});


test('real browser-origin POSTs and HTTPS preview headers reach validation rather than a false 403', async ({ page, request }) => {
  await page.goto('/en/profile');
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/personalization/dashboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teams: [], leagues: [] }) });
    return { status: response.status, body: await response.json() };
  });
  expect(result).toEqual({ status: 400, body: { error: 'invalid_selection' } });
  const preview = await request.post('/api/personalization/dashboard', { data: { teams: [], leagues: [] }, headers: { Host: '3000-preview.e2b.app', Origin: 'https://3000-preview.e2b.app', 'X-Forwarded-Proto': 'https', 'Sec-Fetch-Site': 'same-origin' } });
  expect(preview.status()).toBe(400); expect(await preview.json()).toEqual({ error: 'invalid_selection' });
  const hostile = await request.post('/api/personalization/dashboard', { data: { teams: [], leagues: [] }, headers: { Host: '3000-preview.e2b.app', Origin: 'https://evil.example', 'X-Forwarded-Host': 'evil.example', 'X-Forwarded-Proto': 'https', 'Sec-Fetch-Site': 'same-origin' } });
  expect(hostile.status()).toBe(403);
});


test('returning to a subscriber page reads changes made while no preference hooks were mounted', async ({ page, context }) => {
  await page.goto('/en/profile');
  await expect(page.getByRole('button', { name: 'Follow Al Ahly', exact: true })).toBeEnabled();
  await page.getByRole('banner').getByRole('link', { name: 'News', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/news$/);
  const other = await context.newPage(); await other.goto('/en/profile');
  await other.getByRole('button', { name: 'Follow Al Ahly', exact: true }).click();
  await page.getByRole('banner').getByRole('link', { name: 'My space', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your interests', exact: true }).getByRole('button', { name: 'Unfollow Al Ahly', exact: true })).toBeVisible();
  await other.close();
});

test('unmocked personalised reads preserve interests and disclose provider outages honestly', async ({ page }) => {
  await seed(page);
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/personalization/dashboard');
  await page.goto('/en');
  const response = await pending; expect([200, 503]).toContain(response.status());
  expect(response.headers()['cache-control']).toContain('no-store');
  if (response.status() === 503) await expect(page.getByText('Football data is unavailable right now.', { exact: false })).toBeVisible();
  else await expect(page.getByTestId('personal-dashboard').getByRole('heading', { name: 'Your personal dashboard', exact: true })).toBeVisible();
  expect((await localPreferences(page)).favorites.map((entry) => entry.id)).toEqual(['team:al-ahly-eg']);
  await expect(page.getByRole('heading', { name: en.home.heroTitle, exact: true })).toBeVisible();
});

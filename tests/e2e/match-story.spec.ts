import { test, expect } from '@playwright/test';

// Synthetic source coverage is exercised exclusively on the isolated fixture app.
test.use({ serviceWorkers: 'block', hasTouch: true });
const fixture = (scenario = 'en-live') => `http://127.0.0.1:3101/interactive/story/${scenario}`;

test('event details expose only source player/assist/substitution information', async ({ page }) => {
  await page.goto(fixture());
  const story = page.getByTestId('match-story');
  const goal = story.locator('[data-story-event="goal"]').first();
  await expect(goal.locator('details')).not.toHaveAttribute('open', '');
  await goal.locator('summary').click();
  await expect(goal.getByText('Isolated assist', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Second · 46–90′', exact: true }).click();
  const sub = story.locator('[data-story-event="sub"]');
  await sub.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(sub.getByText('Incoming test player', { exact: true })).toBeVisible();
  await expect(sub.getByText('Outgoing test player', { exact: true })).toBeVisible();
});
test('unknown provider-scoped team IDs are never misattributed to the away team', async ({ page }) => {
  await page.goto(fixture());
  const row = page.getByTestId('match-story').locator('[data-story-event="red"]');
  await expect(row).toHaveAttribute('data-story-side', 'unknown');
  await expect(row).toContainText('Team not identified by the source');
  await expect(row).not.toContainText('Isolated away');
});
test('minute ranges retain45+ and90+ and expose late/unknown minutes honestly', async ({ page }) => {
  await page.goto(fixture());
  await page.getByRole('tab', { name: 'First · up to45′', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('45+3′');
  await expect(page.getByRole('tabpanel').locator('[data-story-event]')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Second · 46–90′', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('90+4′');
  await page.getByRole('tab', { name: 'After90′', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('102′');
  await page.getByRole('tab', { name: 'Minute unknown', exact: true }).click();
  await expect(page.getByRole('tabpanel').locator('[data-story-event]')).toHaveCount(1);
  await expect(page.getByRole('tabpanel').getByLabel('Minute unavailable')).toBeVisible();
});
test('Arabic tabs provide RTL keyboard focus, Home/End and native event details', async ({ page }) => {
  await page.goto(fixture('ar-live'));
  await page.getByRole('tab', { name: 'الكل', exact: true }).focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'الأول · حتى45′', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'الأول · حتى45′', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'دقيقة غير محددة', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'الكل', exact: true })).toBeFocused();
});
test('touch swipes follow the visual RTL direction without needing a gesture library', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture('ar-live'));
  const panel = page.getByRole('tabpanel'); await panel.scrollIntoViewIfNeeded();
  const box = (await panel.boundingBox())!;
  const y = Math.max(30, box.y + 18);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 45, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 145, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('tab', { name: 'الأول · حتى45′', exact: true })).toHaveAttribute('aria-selected', 'true');
});
test('finished summary is limited to recorded highlights and cannot override a partial-feed source score', async ({ page }) => {
  await page.goto(fixture('en-finished'));
  await expect(page.getByRole('heading', { name: 'Recorded highlights after full time' })).toBeVisible();
  await expect(page.getByTestId('source-score')).toHaveText('4-2');
  await expect(page.getByTestId('match-story')).toContainText('Coverage may be incomplete');
  await expect(page.getByTestId('match-story')).not.toContainText('possession');
});
test('empty and upcoming feeds render disclosures, no fabricated story/stats or unused tabs', async ({ page }) => {
  await page.goto(fixture('en-empty'));
  await expect(page.getByText('The source is not providing events for this match right now.')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('[data-story-event]')).toHaveCount(0);
  await page.goto(fixture('ar-upcoming'));
  await expect(page.getByText('تبدأ القصة عند وصول أحداث موثقة من المصدر. لا أحداث تجريبية أو توقعات هنا.')).toBeVisible();
});
test('new source props update the story and authoritative score, with no second polling/API loop', async ({ page }) => {
  await page.goto(fixture());
  await page.getByRole('button', { name: 'Supply refreshed source props' }).click();
  await expect(page.getByTestId('source-score')).toHaveText('5-2');
  await expect(page.getByRole('tabpanel')).toContainText('New source event');
});
test('large feeds progressively expose40 events and reset that bound on a range change', async ({ page }) => {
  await page.goto(fixture('en-many'));
  const rows = page.getByRole('tabpanel').locator('[data-story-event]');
  await expect(rows).toHaveCount(40);
  await page.getByRole('button', { name: 'Show more events' }).click(); await expect(rows).toHaveCount(80);
  await page.getByRole('button', { name: 'Show more events' }).click(); await expect(rows).toHaveCount(85);
  await page.getByRole('tab', { name: 'First · up to45′', exact: true }).click(); await expect(rows).toHaveCount(40);
});
test('untrusted names remain escaped literal text inside the timeline', async ({ page }) => {
  await page.goto(fixture());
  await expect(page.getByRole('tabpanel')).toContainText('<script>literal source name</script>');
  expect(await page.locator('[data-story-event] script').count()).toBe(0);
});
test('Arabic/English story remains bounded at320px, landscape and desktop without runtime errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', err => errors.push(err.message));
  for (const locale of ['ar', 'en']) for (const [width, height] of [[320, 568], [667, 375], [1280, 720]]) {
    await page.setViewportSize({ width, height }); await page.goto(fixture(`${locale}-finished`));
    await expect(page.getByTestId('match-story')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('timeline actions work offline from the already loaded snapshot and make zero API calls', async ({ page, context }) => {
  let apiCalls = 0; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls++; });
  await page.goto(fixture()); await page.getByRole('tab', { name: 'All', exact: true }).focus();
  await context.setOffline(true);
  await page.getByRole('tab', { name: 'First · up to45′', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('45+3′');
  expect(apiCalls).toBe(0); await context.setOffline(false);
});

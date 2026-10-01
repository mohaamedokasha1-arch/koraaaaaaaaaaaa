import { readFile, writeFile } from 'node:fs/promises';
import { liveCatalogSchema, officialChannelsSchema } from '../../src/features/live/types/index.ts';
import { discoveriesSchema, scorebatFeedSchema, youtubeSearchSchema, youtubeVideosSchema } from '../../src/features/live/types/discovery.ts';
import { applyYouTubeMetadata, channelForSlot, mergeDiscoveries, scorebatEmbedFromApi, youtubeCandidate, youtubeMetadataBatch, YOUTUBE_SEARCH_RESULTS } from '../../src/features/live/lib/discovery.ts';
import { catalogChannelIssues } from '../../src/features/live/lib/whitelist.ts';

const root = new URL('../../', import.meta.url);
const catalogPath = new URL('public/live/catalog.json', root);
const discoveriesPath = new URL('public/live/discoveries.json', root);
const now = new Date();
const storeUrl = process.env.NEXT_PUBLIC_LIVE_SUPABASE_URL?.replace(/\/+$/, '');
const serviceRole = process.env.LIVE_SUPABASE_SERVICE_ROLE_KEY;
const durable = Boolean(storeUrl && serviceRole);
const dryRun = process.argv.includes('--dry-run');

async function readJson(response, maxBytes = 3_000_000) {
  if (!response.ok) throw new Error('Upstream service unavailable'); // never print URLs containing keys
  if (!response.body) throw new Error('Empty upstream response');
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('Upstream response too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
async function storeFetch(path, options = {}) {
  const response = await fetch(`${storeUrl}/rest/v1/${path}`, {
    ...options, headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(10_000),
  });
  return readJson(response);
}
async function youtube(endpoint, params, schema) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.search = new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY }).toString();
  return schema.parse(await readJson(await fetch(url, { signal: AbortSignal.timeout(10_000) })));
}

try {
  if (storeUrl) {
    const url = new URL(storeUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.port && url.port !== '443')) throw new Error('Invalid storage URL');
  }
  const channels = officialChannelsSchema.parse(JSON.parse(await readFile(new URL('src/features/live/data/channels.json', root), 'utf8')));
  let catalog = liveCatalogSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));
  let previous = discoveriesSchema.parse(JSON.parse(await readFile(discoveriesPath, 'utf8')));
  if (durable && !dryRun) {
    const rows = await storeFetch('live_catalog?id=eq.primary&select=document');
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('No durable catalogue published');
    catalog = liveCatalogSchema.parse(rows[0].document);
    const discovered = await storeFetch('live_discoveries?id=eq.primary&select=document');
    if (Array.isArray(discovered) && discovered[0]) previous = discoveriesSchema.parse(discovered[0].document);
  }
  const problems = catalogChannelIssues(catalog, channels);
  if (problems.length) throw new Error('Catalogue contains a non-whitelisted YouTube source');
  const original = catalog;
  const candidates = [];
  const channel = channelForSlot(channels, now.getTime());
  if (channel && process.env.YOUTUBE_API_KEY && !dryRun) {
    let permitted = true;
    if (durable) {
      // Daily Pacific-day cap also includes manual runs, matching YouTube quotas.
      const quotaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);
      const limit = await storeFetch('rpc/consume_live_limit', { method: 'POST', body: JSON.stringify({ p_key: `youtube:day:${quotaDay}`, p_limit: 96, p_window_seconds: 86400 }) });
      permitted = limit.allowed === true;
    }
    if (permitted) {
      const search = await youtube('search', { part: 'snippet', channelId: channel.id, type: 'video', eventType: 'live', maxResults: String(YOUTUBE_SEARCH_RESULTS) }, youtubeSearchSchema);
      const linked = catalog.streams.filter((stream) => stream.provider === 'youtube' && stream.channelId === channel.id && stream.status !== 'ended').map((stream) => stream.sourceRef);
      const ids = youtubeMetadataBatch(linked, search.items.map((item) => item.id.videoId), channels.filter((item) => item.enabled).length, now.getTime());
      if (ids.length) {
        const details = await youtube('videos', { part: 'snippet,status,liveStreamingDetails', id: ids.join(',') }, youtubeVideosSchema);
        catalog = applyYouTubeMetadata(catalog, details.items, ids, channels, now.toISOString());
        candidates.push(...details.items.map((video) => youtubeCandidate(video, channel, now.toISOString())).filter(Boolean));
      }
      console.log('Completed one official-channel search (100 units), plus at most one metadata request (1 unit).');
    } else console.log('Daily discovery budget reached; skipped YouTube.');
  } else console.log('YouTube discovery skipped: no enabled reviewed channel or no server-side API key.');

  if (process.env.SCOREBAT_API_TOKEN && !dryRun) {
    const url = new URL('https://www.scorebat.com/video-api/v3/feed/');
    url.searchParams.set('token', process.env.SCOREBAT_API_TOKEN);
    const feed = scorebatFeedSchema.parse(await readJson(await fetch(url, { signal: AbortSignal.timeout(10_000) })));
    for (const match of feed.response) for (const video of match.videos) {
      const sourceRef = scorebatEmbedFromApi(video.embed);
      if (sourceRef) candidates.push({ provider: 'scorebat', sourceRef, title: `${match.title} · ${video.title}`, competition: match.competition ?? '', startsAt: match.date ?? null, discoveredAt: now.toISOString() });
    }
    console.log('Read the official Scorebat API; candidates require manual rights review and match linking.');
  }

  catalog = liveCatalogSchema.parse(catalog);
  const discoveries = discoveriesSchema.parse({ updatedAt: now.toISOString(), candidates: mergeDiscoveries(previous.candidates, candidates, now.getTime()) });
  if (durable && !dryRun) {
    if (catalog !== original && JSON.stringify(catalog) !== JSON.stringify(original)) {
      await storeFetch('rpc/save_live_catalog', { method: 'POST', body: JSON.stringify({ p_document: catalog }) });
      // Include the database's new revision/counters in exported JSON.
      const rows = await storeFetch('live_catalog?id=eq.primary&select=document'); catalog = liveCatalogSchema.parse(rows[0].document);
    }
    await storeFetch('live_discoveries?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ id: 'primary', document: discoveries, updated_at: now.toISOString() }) });
  }
  if (!dryRun) {
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    await writeFile(discoveriesPath, `${JSON.stringify(discoveries, null, 2)}\n`);
  } else console.log('Dry run: no catalogue, discovery, database or filesystem writes.');
  console.log(`${dryRun ? "Prepared" : "Published"} ${discoveries.candidates.length} review candidates; never attached a video to a match automatically.`);
  if (!durable && !dryRun) console.log('JSON mode: outputs are artifacts. Review/commit and redeploy to publish them; no runtime files or branches are written.');
} catch (error) {
  // Do not dump upstream URLs, bodies or fetch errors: they may include API keys.
  console.error('Live sync failed before completion. No unvalidated data was published. Check configuration, upstream quota, schemas and concurrent edits.');
  if (error?.name === 'ZodError') console.error('Upstream data did not pass schema validation.');
  process.exitCode = 1;
}

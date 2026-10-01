import { readFile } from 'node:fs/promises';
import { liveCatalogSchema, officialChannelsSchema } from '../../src/features/live/types/index.ts';
import { catalogChannelIssues } from '../../src/features/live/lib/whitelist.ts';

const root = new URL('../../', import.meta.url);
try {
  const catalog = liveCatalogSchema.parse(JSON.parse(await readFile(new URL('public/live/catalog.json', root), 'utf8')));
  const channels = officialChannelsSchema.parse(JSON.parse(await readFile(new URL('src/features/live/data/channels.json', root), 'utf8')));
  const issues = catalogChannelIssues(catalog, channels);
  if (issues.length) throw new Error(issues.join("\n"));
  console.log(`Valid live data: ${catalog.matches.length} matches, ${catalog.streams.length} reviewed sources, ${channels.length} official channels.`);
} catch (error) {
  console.error('Live catalog/whitelist validation failed:', error instanceof Error ? error.message : 'invalid JSON');
  process.exitCode = 1;
}

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { literal as zLiteral, number as zNumber, object as zObject, string as zString } from 'zod';
import { isLocale } from '@/i18n/locales';
import channels from '../data/channels.json';
import { liveCatalogSchema, officialChannelsSchema, type LiveCatalog } from '../types/index.ts';
import { catalogChannelIssues } from './whitelist.ts';
import { ADMIN_COOKIE, adminConfigured, allowAdminAttempt, isLiveAdmin } from './admin.ts';
import { comparePassword, signAdminSession } from './auth-crypto.ts';
import { liveRpc } from './store-server.ts';

export interface AdminActionState { status: 'idle' | 'error' | 'saved'; issues?: string[]; catalog?: LiveCatalog }

export async function signInLiveAdmin(_previous: AdminActionState, data: FormData): Promise<AdminActionState> {
  const rawLocale = data.get('locale'); const locale = typeof rawLocale === 'string' && isLocale(rawLocale) ? rawLocale : 'ar';
  const password = data.get('password');
  if (!adminConfigured() || typeof password !== 'string' || password.length > 512) return { status: 'error' };
  try {
    if (!(await allowAdminAttempt('login')) || !(await comparePassword(password, process.env.LIVE_ADMIN_PASSWORD!))) return { status: 'error' };
    const cookie = await signAdminSession(process.env.LIVE_ADMIN_PASSWORD!, Date.now());
    (await cookies()).set(ADMIN_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60 });
  } catch { return { status: 'error' }; }
  redirect(`/${locale}/watch/admin`);
}

export async function signOutLiveAdmin(data: FormData): Promise<void> {
  const rawLocale = data.get('locale'); const locale = typeof rawLocale === 'string' && isLocale(rawLocale) ? rawLocale : 'ar';
  (await cookies()).delete(ADMIN_COOKIE);
  redirect(`/${locale}/watch/admin`);
}

export async function saveLiveCatalog(_previous: AdminActionState, data: FormData): Promise<AdminActionState> {
  if (!(await isLiveAdmin())) return { status: 'error' };
  const document = data.get('document');
  if (typeof document !== 'string' || new TextEncoder().encode(document).byteLength > 1_000_000) return { status: 'error', issues: ['document: maximum 1 MB'] };
  let raw: unknown;
  try { raw = JSON.parse(document) as unknown; } catch { return { status: 'error', issues: ['document: invalid JSON'] }; }
  const parsed = liveCatalogSchema.safeParse(raw);
  if (!parsed.success) return { status: 'error', issues: parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  const channelIssues = catalogChannelIssues(parsed.data, officialChannelsSchema.parse(channels));
  if (channelIssues.length) return { status: 'error', issues: channelIssues.slice(0, 12) };
  try {
    if (!(await allowAdminAttempt('save'))) return { status: 'error' };
    const published = await liveRpc('save_live_catalog', { p_document: { ...parsed.data, updatedAt: new Date().toISOString() } }, zObject({ saved: zLiteral(true), revision: zNumber().int(), updatedAt: zString().datetime({ offset: true }) }));
    revalidateTag('live-catalog', 'max');
    revalidatePath('/[locale]/watch', 'layout');
    return { status: 'saved', catalog: { ...parsed.data, revision: published.revision, updatedAt: published.updatedAt } };
  } catch { return { status: 'error' }; }
}

'use client';

import dynamic from 'next/dynamic';
import type { Locale } from '@/i18n/locales';
import type { DashboardLabels } from './HomeDashboard';
import { usePreferences } from '../hooks/usePreferences';

// Dashboard rendering/fetching is deferred; existing public polling is unchanged.
const HomeDashboard = dynamic(() => import('./HomeDashboard'), {
  ssr: false,
  loading: () => <section className="card px-5 py-6" aria-busy="true"><p role="status" className="text-sm text-slate-400">جارٍ تحميل لوحتك الشخصية… / Loading your dashboard…</p></section>,
});

export function HomeGate({ locale, tz, labels }: { locale: Locale; tz: string; labels: DashboardLabels }) {
  const { preferences, ready, persistence } = usePreferences();
  if (!ready || !preferences.dashboardEnabled || preferences.favorites.length === 0 || persistence === 'unsupported') return null;
  return <HomeDashboard locale={locale} tz={tz} labels={labels} />;
}

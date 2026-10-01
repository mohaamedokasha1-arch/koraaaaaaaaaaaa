# قائمة الملفات المتغيرة — 2026-10-01

93 ملفًا بالنسبة إلى بداية الجلسة: **13 ملفات موجودة معدلة** و**80 ملفات جديدة**. هذه قائمة تغييرات التنفيذ التي جرى التحقق منها قبل نشر pull request.

التقسيم أدناه حسب مسؤولية المرحلة؛ بعض الملفات (العقود/fallback/hooks/config مثلًا) أُعيد تدقيقها وتحسينها لاحقًا. كل مسار مدرج مرة واحدة، والبوابات أُعيدت على المجموع النهائي.

## ما لم يتغير

- جميع `src/lib/**`: facade/types/providers/cache/store/normalization ومقدمو النتائج.
- صفحات النتائج/التفاصيل/النتائج المباشرة الحالية، و`src/app/api/matches/live/route.ts`.
- لا فيديو أو dataset كبير أو بيانات مصادر افتراضية في Git؛ builds/node_modules/traces/screenshots/generated fixture types مُستثناة.
- العمل على فرع الجلسة الحالي؛ لم يُنشأ فرع عمل آخر ولم يُدمج شيء في `main`.

## التحقق

المراحل 1/2/3: الأنواع وlint والبناء ناجحة، واختبارات Node 103/105/119 على الترتيب.
المجموع النهائي: **124 اختبار Node، 12 Playwright، 24 تحقق PostgreSQL محلي**؛ build والعلم مغلق/مفتوح ناجحان، وaudit صفر vulnerabilities.

Lighthouse mobile: **96 أداء / 100 إتاحة / 100 ممارسات / 100 SEO** لكتالوج فارغ. القياسات ليست ضمانًا لبث/ترخيص/أداء فعلي. التفاصيل والقيود: [QA.md](./QA.md). التشغيل ومبررات التبعيات: [README.md](./README.md).

## المرحلة 1 — العقود والسياسة والمحرك (11 ملفات)

- `package-lock.json` — معدل
- `package.json` — معدل
- `scripts/live/validate.mjs` — جديد
- `src/features/live/lib/catalog.ts` — جديد
- `src/features/live/lib/config.ts` — جديد
- `src/features/live/lib/fallback.ts` — جديد
- `src/features/live/lib/policy.mjs` — جديد
- `src/features/live/types/index.ts` — جديد
- `tests/live-fallback.test.mjs` — جديد
- `tests/live-schema.test.mjs` — جديد
- `tsconfig.json` — معدل

## المرحلة 2 — الواجهة والمشغلات والتكامل والصفحات (43 ملفات)

- `.env.example` — معدل
- `next.config.mjs` — معدل
- `public/live/catalog.json` — جديد
- `src/app/[locale]/watch/[matchId]/page.tsx` — جديد
- `src/app/[locale]/watch/copyright/page.tsx` — جديد
- `src/app/[locale]/watch/disclaimer/page.tsx` — جديد
- `src/app/[locale]/watch/page.tsx` — جديد
- `src/components/footer.tsx` — معدل
- `src/components/match-card.tsx` — معدل
- `src/components/nav-links.tsx` — معدل
- `src/components/timezone-select.tsx` — معدل
- `src/features/live/adapters/external.tsx` — جديد
- `src/features/live/adapters/hls.tsx` — جديد
- `src/features/live/adapters/iframe.tsx` — جديد
- `src/features/live/adapters/twitch.tsx` — جديد
- `src/features/live/adapters/types.ts` — جديد
- `src/features/live/adapters/urls.ts` — جديد
- `src/features/live/adapters/youtube-api.ts` — جديد
- `src/features/live/adapters/youtube.tsx` — جديد
- `src/features/live/components/Countdown.tsx` — جديد
- `src/features/live/components/LiveHub.tsx` — جديد
- `src/features/live/components/LiveIcon.tsx` — جديد
- `src/features/live/components/LiveLegalLinks.tsx` — جديد
- `src/features/live/components/LiveMatchCard.tsx` — جديد
- `src/features/live/components/LiveMatchView.tsx` — جديد
- `src/features/live/components/MatchTabs.tsx` — جديد
- `src/features/live/components/OfficialPlatforms.tsx` — جديد
- `src/features/live/components/PlayerErrorBoundary.tsx` — جديد
- `src/features/live/components/PlayerLoader.tsx` — جديد
- `src/features/live/components/PlayerSkeleton.tsx` — جديد
- `src/features/live/components/RightsForm.tsx` — جديد
- `src/features/live/components/ServerSwitcher.tsx` — جديد
- `src/features/live/components/StreamPlayer.tsx` — جديد
- `src/features/live/components/WatchMatchLink.tsx` — جديد
- `src/features/live/components/WhereToWatch.tsx` — جديد
- `src/features/live/hooks/useLiveCatalog.ts` — جديد
- `src/features/live/hooks/useLiveScores.ts` — جديد
- `src/features/live/hooks/useStreamFallback.ts` — جديد
- `src/features/live/lib/calendar.ts` — جديد
- `src/features/live/lib/copy.ts` — جديد
- `src/features/live/lib/data.ts` — جديد
- `src/proxy.ts` — معدل
- `tests/live-calendar.test.mjs` — جديد

## المرحلة 3 — التخزين والتقارير والإدارة والاكتشاف (21 ملفات)

- `.github/workflows/live-discovery.yml` — جديد
- `docs/live/supabase.sql` — جديد
- `public/live/discoveries.json` — جديد
- `scripts/live/sync.mjs` — جديد
- `src/app/[locale]/watch/admin/page.tsx` — جديد
- `src/app/api/live/report/route.ts` — جديد
- `src/features/live/components/AdminForms.tsx` — جديد
- `src/features/live/components/ReportButton.tsx` — جديد
- `src/features/live/data/channels.json` — جديد
- `src/features/live/lib/admin-actions.ts` — جديد
- `src/features/live/lib/admin.ts` — جديد
- `src/features/live/lib/auth-crypto.ts` — جديد
- `src/features/live/lib/discovery.ts` — جديد
- `src/features/live/lib/http.ts` — جديد
- `src/features/live/lib/report-handler.ts` — جديد
- `src/features/live/lib/store-server.ts` — جديد
- `src/features/live/lib/whitelist.ts` — جديد
- `src/features/live/types/discovery.ts` — جديد
- `tests/live-auth.test.mjs` — جديد
- `tests/live-discovery.test.mjs` — جديد
- `tests/live-report.test.mjs` — جديد

## المرحلة 4 — اختبارات المتصفح والأداء والتوثيق (18 ملفات)

- `.github/workflows/live-quality.yml` — جديد
- `.gitignore` — معدل
- `README.md` — معدل
- `docs/live/CHANGES.md` — جديد
- `docs/live/QA.md` — جديد
- `docs/live/README.md` — جديد
- `eslint.config.mjs` — معدل
- `playwright.config.ts` — جديد
- `scripts/live/check-sql.mjs` — جديد
- `src/features/live/hooks/useLiveTimezone.ts` — جديد
- `tests/e2e/fixture-app/app/layout.tsx` — جديد
- `tests/e2e/fixture-app/app/page.tsx` — جديد
- `tests/e2e/fixture-app/fixture.ts` — جديد
- `tests/e2e/fixture-app/hls-mock.ts` — جديد
- `tests/e2e/fixture-app/next.config.mjs` — جديد
- `tests/e2e/fixture-app/postcss.config.mjs` — جديد
- `tests/e2e/fixture-app/tsconfig.json` — جديد
- `tests/e2e/live.spec.ts` — جديد

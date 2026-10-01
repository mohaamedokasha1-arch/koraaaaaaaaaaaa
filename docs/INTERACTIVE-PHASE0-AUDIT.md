# فحص ما قبل الدورة الأولى — تجربة KoraScore التفاعلية

**التاريخ المحلي:** 2026-10-02 · **نسخة التطبيق:** `0.1.0` · **الفرع:** `arena/01a0f902-koraaaaaaaaaaaa`.

كُتب هذا الفحص **قبل أي تعديل تطبيق للدورة الجديدة**. توجد تغييرات المرحلة السابقة في مساحة العمل؛ لن تُحذف أو تُكرر. أساس Git هو `f263a0d` بتاريخ2026-10-01، لكنه لا يتضمن بعد ملفات التخصيص المحلية؛ لذلك مساحة العمل الحالية، لا HEAD وحده، هي الـbaseline.

## 1. البنية والجرد

- Next.js16.3.8 App Router/Turbopack، React19.3، TypeScript5.5.4، Tailwind3.4.10، CSS system-font داكن RTL/LTR. لا `pages/` ولا Redux/Context عامة ولا ORM. التخصيص local-first بلا DB؛ وحدة البث تحتوي backend/Supabase اختياريًا يُستخدم عند تهيئته (غير مهيأ في هذه البيئة)، وليس «خدمة بلا قاعدة بيانات».
- `src/app`: صفحات Server Components، Layout عربي/إنجليزي، API Route Handlers، Metadata وSitemap/Robots/Manifest. `src/proxy.ts` للغة والـaliases وحماية المسارات القائمة.
- `src/components`: `Header/Footer/Logo/NavLinks/SearchBox/LangSwitcher/TimezoneSelect/TeamLogo`؛ `MatchCard/MatchList/LiveMatches/StatusChip/MinuteLabel`؛ `StandingsTable/ScorersTable/NewsList/NewsAttribution`؛ `AutoRefresh/EmptyState/PwaRegister`.
- `src/lib`: `football/cache/circuit/matchStore/normalize/h2h/historical/search/news/newsSources/entities/notifications/ratelimit/seo/time`، مع helpers خالصة واختبارات لها في `src/lib/pure`.
- `src/lib/providers`: football-data، API-Football، ESPN، TheSportsDB، openfootball وRSS، مع registry/capability chains وHTTP guards.
- `src/features/live`: وحدة البث الرسمي الاختيارية، catalog، adapters، clock/polling، calendar، fallback، reports وadmin منفصلة.
- `src/features/personalization`: store/preferences/catalog/dashboard/http/copy/server، hooks وFavoriteButton/HomeGate/HomeDashboard/ProfileClient/StorageNotice.
- `tests/*.test.mjs`: Node unit/integration pure tests. `tests/e2e`: Playwright للبث والتخصيص، مع تطبيق fixtures **منعزل**. لا بيانات اختبار ضمن routes/feeds الإنتاجية.
- `public`: أصول الشعار وOG وSW وقوائم البث؛ `scripts`: live وSEO؛ `docs`: تقارير التدقيق والتسليم السابقة. لا وظائف جديدة من هذا الطلب في baseline.

### المسارات القائمة

تحت `/ar` و`/en`: الرئيسية، `/live` نتائج، `/today`، `/results`، `/upcoming`، `/leagues`، `/leagues/[code]` وتبويباتها وأرشيف `/archive/[[...season]]`، `/standings`، `/top-scorers`، `/teams`، `/teams/[id]`، `/matches/[id]`، `/h2h/[a]/[b]`، `/news`، `/search`، `/profile`، `/privacy`، `/offline`.

البث الاختياري: `/watch`، `/watch/[matchId]`، `/watch/admin`، `/watch/copyright`، `/watch/disclaimer`. aliases `/live[/id]` لا تستبدل نتائج `/{locale}/live`.

APIs: `/api/matches/live`، `/api/search`، `/api/news`، `/api/personalization/dashboard`، `/api/health`، `/api/admin/diagnostics`، `/api/cron/warm`، `/api/live/report`، `/api/notifications/subscriptions`. الأخيرة memory-only وليست inbox/delivery حقيقيًا.

SEO: `/sitemap.xml`، ستة `/sitemaps/*.xml`، `/robots.txt`، `/manifest.webmanifest`، `/icon.svg`، `/sw.js`، `/og-default.png`.

## 2. مخزون الميزات — لا إعادة تنفيذ

| الميزة | الحالة قبل الدورة | آخر تحديث مثبت | ملاحظات |
|---|---|---|---|
| النتائج والمواعيد والمباشر | ✅ | كود HEAD2026-10-01 | public polling30ث وcache/circuit؛ مصدر متاح لا يعني تغطية كل مباراة |
| فرق وبطولات وترتيب وهدافون | ✅ | HEAD2026-10-01 | تفاصيل المصدر فقط؛ بعض الخطط محدودة |
| تفاصيل المباراة | ✅ | HEAD2026-10-01 | نتيجة وحالة وتوقيت وvenue/referee وevents **بسيطة غير تفاعلية** |
| Match Story تفاعلي | ❌ | — | لا فلاتر فترات أو تفاصيل حدث قابلة للفتح أو swipe/ملخص أحداث |
| Shareable Cards خاصة بمباراة | ❌ | — | OG افتراضي موجود؛ لا معاينة/تنزيل SVG/PNG أو مشاركة نتيجة مصورة |
| المفضلة والتخصيص | ✅ محلي | تسليم2026-10-01 | ملف زائر ومتصفح فقط؛ بدون cloud accounts |
| الحسابات/المزامنة | ❌ مؤجلة | قرار local-first السابق | لا Fake Login ولا إضافة خدمة في هذه الدورة |
| أخبار وموجز شخصي أساسي | ✅/جزئي | HEAD + تسليم2026-10-01 | RSS opt-in وdedup/clustering وcredits؛ الرئيسية واللوحة تجمعان الأخبار والمباريات؛ لا تكرار Daily Briefing كأنه غير موجود |
| H2H وأرشيف وآخر نتائج الفرق | ✅ | HEAD2026-10-01 | أساس موجود للتحليل القادم؛ ليس تحليلًا تكتيكيًا/تقييم لاعبين |
| possession/shots/corners/lineups/ratings | ❌ في النموذج الحالي | — | **لا حقول في UnifiedMatch ولا استهلاك في adapters**؛ تُخفى الأقسام الناقصة |
| رسوم تفاعلية/ملعب تكتيكي | ❌ | — | squad النادي ليست تشكيلة مباراة، ولا coordinates أو tracking |
| Low Data Mode | ❌ كإعداد | — | system fonts، lazy images، cache وإيقاف التحديث المخفي موجودة بالفعل |
| كرة القدم المصرية | ✅ محدودة | HEAD2026-10-01 | EGY وSeed أندية وhistorical CC0؛ ليس كل كأس/درجة ثانية/شباب |
| تصويتات جمهور مشتركة | ❌ | — | localStorage لا يجمع أصوات عدة زوار ولا يمنع التلاعب؛ تُؤجل حتى backend حقيقي |
| SEO وPWA والرصد الأساسي | ✅ | HEAD2026-10-01 | private noindex، health/diagnostics، logs redaction، offline صريح؛ لا Google ranking/CWV production proof |

## 3. البيانات الفعلية اللازمة للدورة الأولى

`UnifiedMatch` يضم معرف المزود، UTC/date/status/minute، الفريقين/النتيجة/half-time/penalties، البطولة، venue/referee، `events` و`lastUpdated`. `DataResult` يضيف `source/stale/fetchedAt`.

`MatchEvent`: `type/minute/extraMinute/teamId/player/assist/playerOut/playerIn`. الأنواع: goal/own_goal/penalty_goal/yellow/red/yellow_red/sub. **لا event ID أو period رسمي أو coordinates أو statistics أو player ratings.**

| adapter الحالي | أحداث تفاصيل المباراة | بيانات إضافية | الحدود |
|---|---|---|---|
| football-data.org | goals/bookings/substitutions، أحيانًا assist/injuryTime/teamId | score/HT/pens/venue/referee | token server-only؛ أحداث مرهونة بالمصدر/الخطة؛ pacing8/min؛ لا possession/shots مصرفَة |
| ESPN | scoreboard.details عند طلب التفاصيل | minute/status/score | teamId/assist غالبًا null؛ لا SLA/خطة events كاملة؛ عدم نسبة فريق مجهول إلى الضيف |
| API-Football | **events:[] في adapter الحالي** | score/HT/pens/venue/referee | لا طلب events/statistics/lineups مستقل؛100/day وفق catalog، والتمكين يحتاج مفتاحًا |
| TheSportsDB | **events:[]** | score/date/venue | بيانات وخطة محدودة؛ لا رسم قصة افتراضية |
| openfootball | نتائج تاريخية فعلية | أرشيف/H2H/ترتيب مشتق | CC0؛ ليس مصدر tracking أو أحداث/تشكيلات دقيقة |

المفاتيح وfeeds وbackend غير مهيأة في بيئة الفحص (فحص وجود فقط، بلا طباعة قيم). لا يمكن إثبات coverage لخطة إنتاج المستخدم من checkout.

**قرارات الدقة:**

1. النتيجة والدقيقة من المصدر الحالي، **لا حساب للنتيجة من events ناقصة** ولا استنتاج وقت لعب من ساعة الحائط.
2. فترات timeline تقسيم بحسب الدقائق المعطاة مع توضيح أن period الرسمي غير موجود؛ أحداث بلا minute تظل مرئية، ووقت90+ لا يُسمى extra-time يقينًا.
3. الملخص لأحداث موثقة فقط، لا «من سيطر» أو توقع فوز أو تقييم رجل مباراة بلا أرقام.
4. Statistics/tactical/heatmaps/card-statistics لا تظهر دون بيانات مؤكدة. هذه الدورة لا توسع استدعاءات adapters لجلبها.
5. **لا إعادة توزيع صور/شعارات الأندية** في export دون إثبات الترخيص. البديل monograms وأسماء فعلية، مع شعار KoraScore القائم. النظام العام لعرض الشعار لا يُعاد بناؤه.
6. صورة ملف/رابط مشاركة snapshot وليست بثًا يحدث نفسه بعد إرسالها. وقت اللقطة ومصدرها وحداثتها ظاهر، وpreview يتغير عند وصول props حديثة.

## 4. متغيرات البيئة القائمة — أسماء فقط

- بيانات: `FOOTBALL_DATA_API_TOKEN`, `API_FOOTBALL_KEY`, `THESPORTSDB_API_KEY`, `ESPN_PROVIDER_ENABLED`, `OPENFOOTBALL_ENABLED`, `OPENFOOTBALL_TIMEOUT_MS`.
- الأخبار: `NEWS_FEEDS`, `NEWS_PRESETS`, `NEWS_TIMEOUT_MS`.
- HTTP: `PROVIDER_TIMEOUT_MS`, `PROVIDER_TEXT_TIMEOUT_MS`, `PROVIDER_MAX_RETRIES`, `PROVIDER_MAX_TEXT_BYTES`, `CIRCUIT_BREAKER_THRESHOLD`, `CIRCUIT_BREAKER_COOLDOWN_MS`.
- SEO/عرض: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_TIMEZONE`, `GOOGLE_SITE_VERIFICATION`.
- تشغيل محمي: `CRON_SECRET`, `DIAGNOSTICS_TOKEN`.
- البث: `NEXT_PUBLIC_LIVE_ENABLED`, `NEXT_PUBLIC_LIVE_SUPABASE_URL`, `NEXT_PUBLIC_LIVE_SUPABASE_ANON_KEY`, `LIVE_SUPABASE_SERVICE_ROLE_KEY`, `LIVE_REPORT_SALT`, `LIVE_TRUST_PROXY_HEADERS`, `LIVE_ADMIN_PASSWORD`, `LIVE_RIGHTS_EMAIL`, `YOUTUBE_API_KEY`, `SCOREBAT_API_TOKEN`.

لا تغيير أسرار/اشتراك/خطة أو افتراض أن Vercel يوفر DB. خريطة SQL للبث ليست schema مستخدمين/تصويت. `NEXT_PUBLIC_SITE_URL` يجب أن يشير لدومين الإنتاج؛ غير متحقق هنا.

## 5. baseline أُجري قبل التطبيق الجديد

| الفحص | النتيجة |
|---|---|
| `npm run typecheck` | ✅0 |
| `npm run lint` | ✅0 |
| `npm test` | ✅190/190، بلا فشل/تخطي |
| `npm run live:validate` | ✅0 مباريات/مصادر/قنوات فعلية؛ القوائم الفارغة صحيحة |
| `npm run build` | ✅0؛ تحذيرا Edge deprecated/static generation الموروثان فقط |
| live-enabled build و`npm run test:e2e` | ✅38/38، مع Chromium فعلي وfixtures منعزلة |
| `npm audit --json` | ✅0 ثغرات معروفة بجميع درجاتها وقت الفحص؛ ليس ضمان أمان شامل |
| Lighthouse محلي `/ar`، mobile | ✅Performance98 /Accessibility96 /Best Practices96 /SEO100 |
| مقاييس Lighthouse نفسه | FCP0.9s،LCP2.3s،TBT60ms،CLS0،total transferred243KiB |

Lighthouse قياس منفرد ببيانات المصدر غير المهيأة/مقيدة، محلي، وليس staging/Vercel أو CWV ميدانية ولا نسبة تحسن مؤكدة. في هذا القياس31 طلبًا منها11 JavaScript بنقل214,199 بايت، دون خط خارجي. نقاط best-practices المفقودة بسبب فشل شبكة صور البطولة الخارجية، وaccessibility بسبب contrast قائم قبل الدورة؛ لا نخفي هذه النتائج. Playwright38 سيناريو لا يمثل نسبة code coverage شاملة؛ لا metric تغطية شامل مُعرّف حاليًا. لا قياس FPS أو جهاز Safari حقيقي بعد.

أدوات Lighthouse/Chromium أُحضرت **مؤقتًا** للتدقيق دون تغيير package/lock. لا نضيف chart/animation/date libraries لمجرد ورودها في المقترح؛ SWR/Zod/Intl/SVG وNext OG موجودة أصلًا.

## 6. خطة الدورة الأولى فقط

1. تحويل القائمة البسيطة الحالية إلى `MatchStory` ومكون timeline قابل لإعادة الاستخدام، filters/details/keyboard/touch، freshness وملخص نهاية موثق. إعادة استعمال النتيجة وAutoRefresh الحاليين بلا API جديد للقصة.
2. تشغيل اختبارات القصة أولًا، ثم Shareable Cards: SVG خفيف، PNG عند الطلب، معاينة/copy/share مع فشل صادق، OG مطابق للمباراة عند توفر البيانات. تأكيد العربية والترخيص قبل اعتماد أي font/asset.
3. code split أدوات export؛ لا تحميل صور طرف ثالث أو React chart package في الصفحة العامة. حدود صريحة للمدخلات وطلبات OG بلا أسرار أو مدخل URL حر.
4. اختبارات unit/HTTP/browser، RTL320+ وtouch وبيانات كاملة/ناقصة، security وbuild، Lighthouse قابل للمقارنة وتقرير واقعي.
5. تحديث `FEATURES.md` وREADME/report ثم **التوقف قبل الدورة الثانية**. لا merge/main/deploy أو infrastructure دون الموافقة. الفرع ثابت لهذه الجلسة ولا ننشئ feature branch آخر.

المصدر الرسمي الذي راجعناه قبل الاختيار: [Next ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response) (قيود flex/500KB/ttf-otf-woff)، و[ترخيص Noto Sans Arabic OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/OFL.txt). خط الواجهة يظل system؛ أي خط مرخص لازم للرسم سيكون أصلًا محليًا للرسم فقط، لا Google Fonts request لكل قارئ.

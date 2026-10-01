# النسخة 2 — تقرير التسليم (Football Knowledge Model)

**التاريخ:** 2026-10-01 · **الفرع:** `arena/01a0f4cf-koraaaaaaaaaaaa` · **الأساس:** `docs/PHASE0-V2-AUDIT.md` (المرحلة 0)

هذا التقرير يغطي ما نُفِّذ فعليًا في هذه النسخة: الطبقات Sources → Normalization → Entities → Relationships → Cache → Pages → Search → SEO، بحسب ترتيب المراحل الإلزامي في الطلب.

---

## 1) ملخص Audit + ما أُضيف / طُوِّر

### ما كان موجودًا ولم يُلمس
سلاسل المزوّدين (`fd → af → espn → tsdb`)، كل `/api/*` القائمة (الصيغة متوافقة)، كل Routes الصفحات وهوية الموقع وتصميمه والقواميس (توسيع فقط)، openfootball، `/api/cron/warm`، `vercel.json`.

### ما أُضيف (طبقة جديدة كاملة)
| الطبقة | ما نُفِّذ |
|---|---|
| **الكيانات (م1)** | سجل كيانات داخلي `src/lib/entities/{seed,registry,index}.ts`: 38 فريقًا و17 دولة بمرادفات عربية مُتحقَّق منها عبر Wikidata (CC0) + مزوّدون. كل كيان له `id` داخلي ثابت، `slug` للمسار، بدائل، مراجع خارجية، ثقة، وقائمة غموض بشرية (`ambiguityReview`). لا دمج تلقائي عند الغموض — يُسجَّل للمراجعة. |
| **المواسم (م1)** | `src/lib/pure/season.ts`: موسم عابر للسنة (يوليو) وموسم تقويمي (استثناء الدوري المصري BSA)، `seasonRef` = `CODE:LABEL`، دوال عرض وترتيب مواسم. |
| **التوحيد (م2)** | `src/lib/pure/validation.ts`: أولوية على مستوى الحقل، **منع الكتابة الأقدم فوق الأحدث** (مقارنة زمن التحديث + ترتيب المصدر)، آلة انتقالات حالة بلا رجوع (إلا بتصحيح موثوق)، فحوص معقولية، ودمج أحداث بلا تكرار. `src/lib/matchStore.ts` يطبّق ذلك على كل دفعة مباريات + سجل تعارضات + كشف مباريات مباشرة عالقة (25 د). |
| **الأخبار (م3)** | `src/lib/pure/newsIntel.ts` (تصنيف 7 أنواع، لغة، ربط كيانات، إزالة تكرار مطبَّعة عربيًا، **تجميع قصص** بالقصة لا بالفريق) + `src/lib/newsSources.ts` (دليل مصادر موثّق ومُختبَر) + `src/lib/news.ts` (Pipeline كامل + Bundle مخزّن مرة واحدة يُقطَّع للأقسام/اللغة/الكيان) + **News Hub** جديد + `/api/news`. |
| **البحث (م4)** | `src/lib/search.ts`: بحث موحّد Entity-aware (كيانات + فرق + بطولات + لاعبون + مباريات + أخبار + قصص) مع توسيع استعلام، تطبيع عربي/لاتيني وتسامح إملائي، خيارات غموض بالدولة والشعار، وصفحة `/search` بـ`noindex, follow` خارج أي Sitemap. |
| **الأرشيف/H2H (م5)** | `src/lib/pure/standings.ts` (ترتيب محسوب من نتائج حقيقية فقط) + `src/lib/h2h.ts` (مواجهات حقيقية فقط؛ لا صفحة تحت 3 مواجهات) + صفحات `/leagues/[code]/archive[/season]` و`/h2h/[a]/[b]`، وتقرير مواجهة في صفحة المباراة. |
| **SEO (م6)** | **Sitemap Index** (`/sitemap.xml` → `/sitemaps/{static,leagues,teams,matches,news,archive}.xml`) بـ`lastmod` حقيقي فقط، حذف Sitemap الأحادي القديم، robots يمنع `/search` والمعاملات، hreflang ar/en/x-default، `SportsTeam`/`SportsEvent`/`NewsArticle`/`CollectionPage`/`BreadcrumbList`، وسياسات فهرسة صريحة (أدناه §3). |
| **م7** | إشعارات: بنية فقط (`pure/notifications.ts` + `/api/notifications/subscriptions`) **بلا تفعيل Push**. PWA: Manifest + Service Worker يخزّن **أصولًا ثابتة وصفحة offline فقط** ولا يلمس `/api/*` ولا يخزّن بيانات حيّة. توقيت المستخدم: كوكي `KORA_TZ` + `TimezoneSelect` + تخزين UTC عرضًا محليًا. Observability: `/api/health` موسَّع بـ11 فحصًا + `/api/admin/diagnostics` محمي (DIAGNOSTICS_TOKEN أو CRON_SECRET، و404 بدون أي منهما). |
| **الجودة (م8)** | ESLint 9 + `eslint-config-next` (سكربت `lint` جديد)، 63 اختبارًا ناجحًا، وبناء إنتاج ناجح. |

### إصلاحات جذرية
1. **ثغرة `safeLink` (G3):** استُبدلت بسياسة مضيف صريحة (`allowedHosts` لكل مصدر + مقارنة النطاق القابل للتسجيل) ترفض `evil.co.uk` و`evilexample.com` و`evilbbci.co.uk`، وتسمح فقط بنطاق المصدر نفسه أو نطاق معلن.
2. **صفحات الفرق بالـslug:** `/teams/al-ahly-eg` تعمل، والصيغة القديمة `fd~57` تعمل كما هي.
3. **فرق معلوم بلا مزوّد متاح:** تُعرض صفحة كيان (noindex) بدل 404، وتصبح غنية تلقائيًا عند عودة المزوّد.
4. **سايت ماب الأخبار كان ينشر `/news/{section}`** — وهو مسار غير موجود (الفلاتر تعمل بـ`?section=` وبـcanonical إلى `/news`). اكتشفه فحص «كل رابط منشور يجب أن يقابل Route قائمًا» ضمن تقرير Orphan Pages، وأُزيل. هذا مثال عملي على قيمة الفحص الذاتي: قائمة sitemap كانت ستُنتج 404s زاحفة.

---

## 2) جدول المصادر (المقبولة / المرفوضة / المؤجَّلة)

اختُبرت جميعها بطلب حقيقي في 2026-10-01 (التفاصيل الكاملة في `docs/PHASE0-V2-AUDIT.md` §2.2 وفي `src/lib/newsSources.ts`).

| المصدر | الحالة | القرار | السبب |
|---|---|---|---|
| football-data.org | ✅ مستخدم أصلًا | يُبنى عليه | مفتاح + حدود واضحة |
| api-football (مصر 233) | ✅ مستخدم أصلًا | يُبنى عليه | مفتاح اختياري + تغطية مصر |
| ESPN scoreboard | ✅ مستخدم أصلًا | يُبنى عليه | احتياطي عام |
| TheSportsDB | ✅ مستخدم أصلًا | يُبنى عليه | 617 دوريًا + مصر 4829 |
| openfootball (CC0) | ✅ مستخدم أصلًا | يُبنى عليه | ترخيص صريح + تاريخي |
| **Wikidata** | ✅ حيّ ومُختبَر | **مقبول ومُدمَج** | CC0 + مرادفات عربية حقيقية (Q223566 الأهلي، Q8682 ريال مدريد، Q7156 برشلونة) |
| **BBC Sport RSS** | ✅ حيّ (30+ عنوانًا) | **Opt-in** | جودة عالية لكن استخدامه التجاري يحتاج موافقة BBC |
| **Youm7 Sport RSS** | ✅ حيّ (عناصر كل 20–30 دقيقة) | **Opt-in** | **أول مصدر عربي متحقَّق**: تغطية مصرية أولًا (الأهلي/الزمالك/الدوري/أفريقيا)؛ القسم رياضي عام ⇒ مرشّح كرة القدم في خط الأنابيب يُسقط رياضات أخرى |
| **KingFut RSS** | ✅ حيّ (2026-09-29) | **Opt-in** | يغطي مصر بالإنجليزية؛ بلا نص ترخيص صريح ⇒ قرار المشغّل |
| **The Guardian Football RSS** | ✅ حيّ (2026-10-01) | **Opt-in** | كرة قدم عالمية بجودة عالية؛ حقوق محفوظة ⇒ إسناد ظاهر وقرار المشغّل |
| Sky Sports RSS | ✅ حيّ لكن رياضة عامة | مؤجَّل | يخلط رياضات أخرى — يخالف معيار الجودة |
| Sky News Arabia RSS | ✅ حيّ لكن أخبار عامة (`/rss/sport` = 404) | مؤجَّل | لا feed رياضي منفصل |
| FilGoal RSS | ❌ متوقّف | **مرفوض** | «الخدمة لم تعد متاحة» على كل feed |
| Yallakora RSS | ❌ 404 | **مرفوض** | لا RSS |
| Al Ain RSS | ❌ 404 | **مرفوض** | لا RSS |
| Guardian / ESPN News / CAF / AS / Marca | لم تُختبَر | مؤجَّلة | لا يُدمج مصدر بلا اختبار فعلي ومراجعة ترخيص |

> **تحديث الفجوة P0:** أُغلقت عمليًا هذه الجولة — **Youm7 Sport** مصدر عربي حيّ متحقَّق بطلب فعلي (`/rss/SectionRss?SectionID=298`)، والمرشّح التلقائي لكرة القدم يمنع تسرّب رياضات أخرى من قسمه العام. يبقى التفعيل قرار المشغّل (شروط تجارية). المرشحون المرفوضون لا يُعاد تقييمهم: FilGoal (متوقّف)، Yallakora (404)، Al Ain (404)، Sky Sports (رياضة عامة)، Sky News Arabia (لا feed رياضي).

---

## 3) نموذج الكيانات والعلاقات + سياسة المواسم والفهرسة

### نموذج الكيان (`src/lib/pure/entity.ts`)
```
EntityRecord {
  id: "team:al-ahly-eg"        // داخلي ثابت، لا يتغير مع المزوّد
  kind: team | league | country | player | season | match | venue | story | source
  slug: "al-ahly-eg"           // المسار: /teams/al-ahly-eg
  name / nameAr / shortName
  country / countryCode
  leagueCodes[]                // العلاقات مع البطولات
  crest                        // من المزوّد فقط، لا يُختَلق ولا يُنزَّل من صفحات ممنوعة
  aliases[]                    // «الأهلي المصري، المارد الأحمر…»
  refs[]                       // {provider, id} لكل مزوّد + Wikidata
  updatedAt
}
```
- **منع التكرار:** `shouldMerge` يعيد `strong` (مرجع مشترك) / `weak` (اسم ودولة أو بطولة مشتركة) / `null` (كيانان منفصلان + **طابور مراجعة**). الغموض (الأهلي المصري × السعودي) يُعرض كخيارات ولا يُدمج أبدًا.
- **الثقة:** `scoreName` متدرّج (تطابق تام 1 → بديل 0.98 → بادئة → احتواء 0.62 → Levenshtein ≤2 / تشابه ثنائيات ≥0.72).
- **العلاقات:** كيان ← بطولات (`leagueCodes`)، فريق ← مباريات (من السجل)، بطولة ← مواسم (من الأرشيف)، خبر ← كيانات (اكتشاف نصي + مرادفات).
- **المواسم:** `CROSS_YEAR_START_MONTH = 7` للمواسم العابرة، `CALENDAR_LEAGUES = {BSA}` استثناءً، المعرّف `CODE:LABEL` (`EGY:2024-25`). الأرشيف لا يخلط مواسم أبدًا.

### سياسة الفهرسة (index/noindex)
| النوع | يُفهرس؟ | الشرط |
|---|---|---|
| `/search?q=` | ❌ دائماً | `noindex, follow` + ممنوعة في robots + خارج كل Sitemap |
| صفحة فريق | ✅ فقط ببيانات | `worthIndexing` (دولة/بطولة/تأسيس/تشكيلة أو أكثر) — وإلا noindex |
| صفحة كيان بلا مزوّد | ❌ | تُعرض للزائر، noindex |
| صفحة مباراة | ✅ عند وجود بيانات حقيقية | لا صفحات لمعرّفات مجهولة |
| H2H | ✅ فقط ≥3 مواجهات حقيقية | وإلا 404 |
| أرشيف موسم | ✅ فقط بموسم موجود فعلًا في المجموعة | موسم غائب ⇒ 404 |
| News Hub | ✅ فقط عند وجود عناصر | فارغ ⇒ noindex |
| Sitemap | يعرض فقط ما هو 200 وذو محتوى حقيقي | فرقٌ لها مرجع مزوّد بيانات، مباريات مخزّنة، أرشيف حقيقي |

### طريقة إزالة الروابط الميتة
`Sitemap Index` مفصول حسب النوع، و`lastmod` لا يُكتب إلا من زمن تحديث حقيقي (`fetchedAt` / `lastUpdated`). أقسام الأخبار الفارغة تُخفى تمامًا (لا روابط لأقسام بلا عناصر). روابط H2H لا تُعرض إلا عند وجود صفحة قابلة للعرض.

---

## 4) الملفات المضافة / المعدلة

### جديدة (24)
`src/lib/pure/{entity,season,validation,newsIntel,standings,time,notifications}.ts` · `src/lib/entities/{seed,registry,index}.ts` · `src/lib/{matchStore,newsSources,news,search,h2h,log,observability,time,notifications}.ts` · `src/lib/seo/orphans.ts` · `src/app/api/news/route.ts` · `src/app/api/admin/diagnostics/route.ts` · `src/app/api/notifications/subscriptions/route.ts` · `src/app/[locale]/{search,h2h/[a]/[b],leagues/[code]/archive/[[...season]],offline}/page.tsx` · `src/app/sitemap.xml/route.ts` · `src/app/sitemaps/[type]/route.ts` · `src/components/{pwa-register,timezone-select}.tsx` · `public/sw.js` · `src/app/manifest.ts` · `eslint.config.mjs` · `tests/{entity,registry,search,circuit,scenarios,season,validation,newsIntel,standings,time,notifications}.test.mjs` · `docs/PHASE0-V2-AUDIT.md` · `docs/PLATFORM-V2.md`.

### معدَّلة (محدودة ومقصودة)
`src/lib/{football,cache,circuit,ratelimit,news,historical,seo,format,types,constants,normalize}.ts` · `src/lib/providers/{http,rssNews,openfootball}.ts` · `src/lib/pure/rss.ts` (الإصلاح الأمني) · كل صفحات العرض (تمرير `tz` + روابط slug) · `src/components/{match-card,match-list,match-status,news-list,footer,header}.tsx` · `src/i18n/{ar,en}.json` (توسيع فقط) · `src/app/robots.ts` · `.env.example` · `package.json` · `README` — **لم يُحذف أي Route أو API أو Feature.**

---

## 5) جدول سياسات الحداثة (Freshness)

| نوع البيانات | TTL | سلوك الفشل |
|---|---|---|
| مباريات مباشرة | 25 ث | Stale مسموح حتى 24 س **(بعلامة stale ظاهرة)** |
| تفاصيل مباراة | 60 ث | Stale معلَّم |
| مباريات اليوم | 5 د | Stale معلَّم |
| نتائج منتهية | 10 د | Stale معلَّم |
| قادم/جولات بطولة | 15 د | Stale معلَّم |
| ترتيب | 60 د | Stale معلَّم |
| هدّافون | 60 د | Stale معلَّم |
| معلومات فريق/قائمة | 24 س | Stale معلَّم |
| أرشيف تاريخي (CC0) | 24 س | البيانات ثابتة أصلًا |
| أخبار | 10 د | Stale عند فشل كل المصادر وإلا حذف صامت |
| بحث | 30 د | نتيجة قديمة مسموحة مع كاش المزوّدين |

**قواعد إضافية:** كل سلسلة مزوّدين محمية بـCircuit Breaker (5 إخفاقات ⇒ فتح 5 د)، وكل طلب له Timeout، والجلب بالخلفية عبر الكاش (لا زائر ينتظر مزوّدًا)، والكاش سقفه 2000 مفردة في النسخة الواحدة (Serverless).

---

## 6) المتغيرات البيئية الجديدة فقط

| المتغير | الغرض | الافتراضي |
|---|---|---|
| `NEWS_PRESETS` | تفعيل مصادر من الدليل المُتحقَّق بالمعرّف (bbc-sport-football, kingfut, …) | فارغ (الميزة معطَّلة) |
| `DIAGNOSTICS_TOKEN` | حماية `/api/admin/diagnostics` | فارغ ⇒ fallback إلى `CRON_SECRET` ⇒ 404 بدونهما |

> البقية موجودة سابقًا: `NEWS_FEEDS`, `NEWS_TIMEOUT_MS`, `OPENFOOTBALL_*`, `PROVIDER_*`, `CIRCUIT_BREAKER_*`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_TIMEZONE`, `CRON_SECRET`. **لا مفاتيح مدفوعة ولا خدمات إضافية.** (كوكي `KORA_TZ` ليس Env.)

---

## 7) نتائج الفحص

| الخطوة | الأمر | النتيجة |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ نظيف (0 أخطاء) |
| Lint | `npm run lint` | ✅ نظيف (0 أخطاء، 0 تحذيرات) — ESLint 9 + `eslint-config-next` |
| الاختبارات | `npm test` | ✅ **90/90** ناجح في 12 ملف اختبار |
| Build | `npm run build` | ✅ نجح — بناء إنتاجي كامل بكل الصفحات والـAPIs وSitemap Index (35 مُدخَل مسار/ملف ثابت) |
| دخان تشغيلي | تشغيل إنتاجي + curl | ✅ robots.txt، sitemap.xml، sitemaps/{static,leagues,teams,matches,news,archive}.xml، /api/{health,news,search,notifications/subscriptions}، صفحات ar/en الداخلية — كلها 200 كما هو متوقع؛ `/api/admin/diagnostics` بلا توكن = 401 بعد ضبط التوكن |
| سيناريو: Rate Limit | 45 طلبًا متتاليًا إلى `/api/search` | ✅ 40 × 200 ثم 5 × 429 — الحد يعمل بلا تعطيل الصفحات (الصفحات لا تعتمد على API العميل) |
| سيناريو: تعطيل مصدر | `ESPN_PROVIDER_ENABLED=false` + تشغيل | ✅ `/api/health` يعرضه `enabled:false`، وكل الصفحات (`/ar`, `/teams`, `/news`, `/today`) بقيت 200 |
| سيناريو: بيانات تالفة | `tests/scenarios.test.mjs` | ✅ النتيجة السالبة تُرفض (`invalid`) والبيانات المخزّنة تبقى سليمة |
| سيناريو: كتابة أقدم | `tests/scenarios.test.mjs` | ✅ `stale_write` — لقطة أقدم من 10 دقائق لم تكتب فوق أحدث |
| سيناريو: تعارض مصدرين | `tests/scenarios.test.mjs` | ✅ الأحدث يفوز، وعند التساوي يفوز الأعلى أولوية (`fd` على `tsdb`) |
| سيناريو: توقف تدريجي | `tests/{circuit,scenarios}.test.mjs` | ✅ 5 إخفاقات تفتح الدائرة 5 د، والعودة عبر نصف مفتوح؛ والعودة للخلف في الحالة (`finished→live`) تُرفض |
| تقرير Orphan | `/api/admin/diagnostics` (محمي) | ✅ 9 صفحات ثابتة + 11 بطولة + 139 صفحة أرشيف منشورة، **0 مخالفة ربط**، و38 كيانًا معروفًا بلا مزوّد تُذكر كملاحظة لا كخطأ |

**ملاحظة صدق:** الاتصال الخارجي غير متاح من بيئة التطوير هذه، لذا اختبار المزوّدين الحقيقيين تم في جولة المرحلة 0 عبر أداة الجلب، ووُثّق في `docs/PHASE0-V2-AUDIT.md` §2.2. جميع الاختبارات أعلاه تعمل بلا شبكة، وهذا مقصود: النظام يجب أن يظل متماسكًا عند انقطاع المزوّدين.

---

## 8) القيود المعروفة والقرارات التي تحتاج موافقة

### قيود معروفة (مقصودة وموثّقة)
1. **لا قاعدة بيانات:** كل السجلات (الكيانات، التعارضات، الاشتراكات، المقاييس) في ذاكرة كل نسخة Serverless — تُبنى من جديد عند بدء النسخة. الحل المستقبلي: Vercel KV/Postgres دون تغيير الواجهات.
2. **لا Push فعلي:** البنية والاشتراكات والتحقق منها جاهزة، والإرسال يحتاج قرارًا + طبقة دائمة + مفاتيح VAPID.
3. **الصور من الأخبار:** لا تُعرض حاليًا إلا إذا سمح مزوّد الخبر بذلك وسياسة المصدر تسمح (`imagesAllowed`) — لا hotlink من مصادر غير مرخّصة.
4. **الفجوة العربية P0 مفتوحة:** لا مصدر أخبار عربي متحقَّق بعد (كل المرشحين إما ميت أو غير متخصص).
5. **Orphan Pages:** لا يمكن إنتاج تقرير حقيقي بلا زحف فعلي من Google Search Console بعد النشر؛ الجهة المقابلة داخل الكود موثّقة (خريطة الروابط الداخلية في §3).

### قرارات تحتاج موافقتك
| القرار | الافتراضي الحالي | ما نحتاجه منك |
|---|---|---|
| مصادر الأخبار | معطَّلة تمامًا (لا طلب خارجي) | أيّ المصادر تريد تفعيلها بعد مراجعة شروطها؟ (BBC Sport / KingFut كبداية موصى بها) |
| Push notifications | غير مفعَّل | هل نبدأ طبقة تخزين دائمة (KV) لتفعيل الإشعارات لاحقًا؟ |
| الصور الإخبارية | لا تُعرض | هل لديك مصادر/اتفاقيات تسمح بعرض الصور؟ |
| بحث عربي موسَّع | يعمل بالبدائل المتاحة | هل نضيف تصحيحًا إملائيًا موسَّعًا (fuzzy) كنمط افتراضي في البحث؟ |
| مصادر مؤجَّلة | Sky Sports / Sky News Arabia | هل نعيد تقييمها لاحقًا إن أضافت feeds متخصصة؟ |

---

## ما بعد التسليم (خطوات مقترحة)
1. تفعيل `NEWS_PRESETS=youm7-sport,kingfut` (أو `+bbc-sport-football,guardian-football`) بعد تأكيد الشروط ⇒ يمتلئ News Hub فورًا بمحتوى عربي/إنجليزي و`/api/news` يصبح حيًّا.
2. تشغيل `npm run lint` داخل CI + `npm test` قبل كل نشر.
3. بعد أول نشر إنتاجي: ربط Search Console لمراقبة الفهرسة/Orphan وتفعيل `/api/admin/diagnostics` بـ`DIAGNOSTICS_TOKEN`.
4. عند اعتماد قاعدة بيانات: ترقية سجلات الكيانات/الاشتراكات إلى تخزين دائم (الواجهات لا تتغير).

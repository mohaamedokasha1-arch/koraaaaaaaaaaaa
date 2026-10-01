# المرحلة صفر — فحص منصة KoraScore قبل التخصيص والحسابات

- **التاريخ:** 2026-10-01 (UTC).
- **الفرع:** `arena/01a0f902-koraaaaaaaaaaaa`، الأساس `f263a0d`.
- **شرط الترتيب:** أُنجز هذا الفحص وكُتب هذا التقرير قبل تعديل أي كود أو إعداد للمشروع. كان `git status --short` فارغًا قبل إضافة هذا الملف. أُعيد تثبيت الاعتماديات بـ`npm ci` دون تغيير ملفاتها.
- **النطاق التالي:** المرحلة الأولى فقط؛ لا تنفيذ متزامن للمراحل 2–5، ولا إعادة بناء للميزات السابقة.
- **حدود الإثبات:** فحص الملفات، أوامر جودة فعلية محلية، ومراجعة وثائق رسمية عبر HTTPS. لا وصول إلى إعدادات/فواتير Vercel، قاعدة Supabase فعلية، SMTP، Search Console، أو مفاتيح كرة القدم. وجود التكامل في الكود لا يثبت تفعيله على الإنتاج.

## 1. البنية والتنقل

| البند | نتيجة الفحص الحالي |
|---|---|
| الإطار | Next.js **16.3.8**، App Router؛ React **19.3**؛ TypeScript 5.5.4؛ Tailwind 3.4.10. الإصدارات مثبتة في `package-lock.json` وتحققت في البناء. |
| تنظيم المشروع | `src/app` للصفحات وRoute Handlers، `src/components` للمشترك، `src/lib` للخدمات/المزوّدين/الدوال الخالصة، `src/i18n` للقواميس، و`src/features/live` لوحدة البث المنعزلة. نحو 17,219 سطرًا في `src`؛ ليست قاعدة فارغة. |
| Layout | Layout جذري واحد داخل `src/app/[locale]/layout.tsx`: HTML عربي RTL أو إنجليزي LTR، Header/Footer، رابط تخطي المحتوى، JSON-LD، وتسجيل PWA. لا Layout حسابات حاليًا. |
| Middleware | `src/proxy.ts` (اصطلاح Next 16). `/` والمسارات دون لغة تتحول إلى `/ar` أو `/en` بحسب `NEXT_LOCALE`. ملفات عامة وAPI وNext مستثناة. `/live[/id]` يدخل `/[locale]/watch[/id]`، **ولا يبدّل** صفحة نتائج `/[locale]/live`. إدارة البث المغلقة ترجع 404 عند غياب الإعدادات. |
| Server/Client | الصفحات المعلوماتية Server Components ديناميكية؛ Polling والبحث والتنقل واختيار التوقيت Client Components. صفحات البث تستخدم revalidate=60؛ يجب عدم تحويل الـLayout العام إلى قراءة جلسة/قاعدة بيانات لكل زائر. |

### جرد جميع المسارات الحالية

كل الصفحات أدناه تحت `/ar` و`/en` ما عدا النقاط التقنية:

| النوع | المسارات |
|---|---|
| عامة | `/`، `/live`، `/today`، `/results`، `/upcoming`، `/leagues`، `/standings`، `/top-scorers`، `/teams`، `/news`، `/search`، `/offline` |
| ديناميكية | `/leagues/[code]` (ستة تبويبات)، `/leagues/[code]/archive/[[...season]]`، `/teams/[id]` (slug **وصيغة provider القديمة**)، `/matches/[id]`، `/h2h/[a]/[b]` |
| البث الرسمي، opt-in | `/watch`، `/watch/[matchId]`، `/watch/copyright`، `/watch/disclaimer`، `/watch/admin` (محمي، noindex) |
| API | `GET /api/matches/live`؛ `GET /api/search`؛ `GET /api/news`؛ `GET /api/health`؛ `GET /api/admin/diagnostics`؛ `GET /api/cron/warm`؛ `GET/POST/DELETE /api/notifications/subscriptions`؛ `POST /api/live/report` |
| SEO/PWA/static | `/sitemap.xml`؛ `/sitemaps/{static,leagues,teams,matches,news,archive}.xml`؛ `/robots.txt`؛ `/manifest.webmanifest`؛ `/icon.svg`؛ `/sw.js`؛ `/live/{catalog,discoveries}.json`؛ `/og-default.png` |
| أخطاء | not-found عام ومحلي؛ Unknown entities/competitions ترجع 404 بحسب سياسة المحتوى. |

**لا يوجد الآن** `/profile` أو `/account` أو `/saved` أو Route مستخدم للمصادقة أو إعداداته.

## 2. المكوّنات المشتركة ونظام التصميم

- المشترك: `Header`، `Footer`، `Logo`، `NavLinks/MobileNav`، `LangSwitcher`، `SearchBox`، `LeagueSelect`، `TimezoneSelect`، `TeamLogo`.
- كرة القدم: `MatchCard`، `MatchList`، `LiveMatches`، `StatusChip/MinuteLabel`، `StandingsTable`، `ScorersTable`، `AutoRefresh`.
- الأخبار: `NewsList/NewsAttribution`؛ Empty/Error/Stale states موجودة في `empty-state.tsx`.
- وحدة `features/live`: أدوات بث/تبديل مصادر/فشل/تقارير/Countdown وتقويم ICS؛ لا تُكرر أو تُلمس للحسابات العامة.
- **الهوية القائمة:** KoraScore / كورة سكور، شعار SVG كرة/درع، navy + trophy gold + pitch green. Tokens فعلية في `tailwind.config.ts` و`globals.css` (`card`، `btn-*`، `chip`، `section-title`...).
- الخطوط System stack، بلا تنزيل خط خارجي؛ الخلفية الداكنة افتراضية و`className="dark"` دائم. **Dark Mode موجود؛ تبديل Light/Dark غير موجود.**
- RTL/LTR صحيحان في HTML، logical properties في التصميم، `Intl` للأرقام والتواريخ، reduced-motion أساس موجود. لا حاجة لاستبدال الهوية.
- واجهة البحث في Header مخفية على الشاشات الصغيرة؛ صفحة البحث نفسها موجودة. التوسعات الشخصية يجب أن تبقى قابلة لللمس/لوحة المفاتيح، من دون أزرار داخل روابط متداخلة.

## 3. البيانات والمزوّدون وحدودهم

واجهة الخدمات القائمة `src/lib/football.ts` هي نقطة الدخول؛ التسلسل في `providers/registry.ts` يُحفظ دون تغيير:

| المصدر الحالي | التغطية/الاستخدام | الحدود/التحقق |
|---|---|---|
| football-data.org (`fd`) | المباشر، اليوم، المواسم، فرق وتشكيلات، ترتيب وهدافون لعشر بطولات | مفتاح server-only؛ الـadapter يُنظّم 8 طلبات/دقيقة احتياطًا تحت 10/د للخطة المجانية. لا مفتاح هنا لاختبار تغطية الإنتاج. |
| API-Football (`af`) | fallback عند وجود المفتاح؛ منه مصر 233 | اختياري، معطل دون المفتاح؛ الكتالوج يذكر 100 طلب/يوم مجانًا. لا نضيف مزوّدًا بديلًا للوظائف نفسها. |
| ESPN public scoreboard | fallback للمباريات للدوريات الموجودة في الكتالوج | API غير موثق رسميًا ولا SLA/حد ثابت معلن؛ لا نعد بتحديث لحظي. |
| TheSportsDB (`tsdb`) | البحث عن فرق، مصر 4829، معلومات/مباريات فرق وتغطية غير fd | مفتاح عام 3؛ حدود موثقة بالكود/الدليل: ترتيب 5 صفوف، موسم 15 مباراة، قائمة 10 فرق في المفتاح المجاني؛ لا نملأ الناقص افتراضيًا. |
| openfootball (`ofb`) | بيانات تاريخية فعلية، أرشيف، حساب ترتيب من نتائج مكتملة | CC0؛ لا يدخل سلسلة المباشر. لا تُعاد كتابة هذه الوظيفة. |
| Wikidata | أسماء وبدائل في Seed الحالي | CC0؛ إثراء هوية وليس نتائج/إحصائيات. ليس طلبًا حيًا جديدًا. |
| RSS/Atom | أخبار opt-in بـ`NEWS_PRESETS` أو `NEWS_FEEDS` | إسناد مصدر + عنوان/مقتطف قصير/رابط فقط؛ لغة وتصنيف/ربط كيانات/Dedup/Story clustering/Pagination قائمة فعليًا. لا تفعيل لمصدر دون مراجعة ترخيص المشغّل. |
| البث الرسمي | JSON/CDN وSupabase اختياري، HLS/YouTube/Twitch/iframe reviewed | العلم الافتراضي false؛ القوائم الرسمية **فارغة فعلًا**، لا نضيف بثًا أو كيانات تجريبية للإنتاج. |

**الكيانات:** سجل ذاكرة `entities/{seed,registry,index}.ts`؛ 38 ناديًا معروفًا و17 دولة في الـSeed، و11 بطولة في `ALL_LEAGUES` (10 + EGY). هوية `team:<slug>` + refs + aliases؛ كلا المسارين القديم والـslug يعملان. لا كيان لاعب دائم ولا صفحة لاعب مستقلة: اللاعبون يأتون فقط من squad/scorers والبحث في كاشهما؛ لاعب بلا معرف مصدر لا يصلح كمفضلة ثابتة تعتمد على الاسم وحده.

**Caching:** ذاكرة لكل instance (حد 2000 مدخل، stale grace 24h)، وليست قاعدة بيانات ولا تخزينًا متعدد الأجهزة. TTL: مباشر25ث، تفاصيل60ث، اليوم5د، النتائج10د، القادم/مباريات بطولة15د، ترتيب/هدافون1س، فرق/بطولات24س، بحث30د، أخبار10د. توجد React request memoization للتفاصيل وبعض HTTP pacing. **`cachedCall` لا يملك Promise in-flight dedup عامًا**؛ بعض التقارير القديمة تصفه أوسع مما ينفذه. أي API تخصيص يجب أن يعيد استعمال هذه القراءات، ويحد fan-out، ولا يجلب لكل مفضلة دوريًا كاملًا بلا سقف.

**التحديث:** المباشر كل30ث في التبويب الظاهر؛ الصفحات5–15د والتفاصيل قرب البداية60ث. Cache warmer يومي best-effort فقط، وليس job دائمًا ولا notifications worker.

## 4. قاعدة البيانات والمصادقة

| البند | الموجود فعليًا |
|---|---|
| قاعدة بيانات كرة القدم/مستخدمين | **لا توجد**، ولا ORM/Prisma/Drizzle ولا connection string خاص بالمستخدمين. |
| schema اختياري قائم | `docs/live/supabase.sql`: `live_catalog`، `live_limits`، `live_reports`، `live_discoveries`، علاقات/منح/RLS وRPC atomic للبث. لا ملفات profiles/favorites أو users تخصيص. تنفيذ هذا SQL على الإنتاج **غير متحقق منه**. |
| مصادقة عامة | **غير موجودة**؛ لا تسجيل/بريد/Google/استعادة كلمة مرور/حذف حساب/مزامنة. |
| إدارة البث | كوكي httpOnly لجلسة إدارة واحدة، HMAC، كلمة إعداد server-only، Rate limit اختياري عبر DB. ليست مصادقة مستخدمين ولا يمكن استعمالها للحسابات العامة. |
| بيانات مستخدم محلية | اختيار اللغة/الوقت في Cookies، واختيار مصدر البث في localStorage فقط. لا مفضلة/مباريات محفوظة/ملف شخصي. |

التسجيل يجب أن يبقى اختياريًا. لا يجوز تقديم Map الذاكرة كتخزين حسابات ولا تخزين كلمات مرور في localStorage أو ملف JSON أو logs.

## 5. SEO والفهرسة

✅ `seo.ts` موحد وMetadata لكل صفحة، Canonical مطلق ذاتي، hreflang ar/en/x-default، صورة OG قائمة، JSON-LD WebSite/Organization/Breadcrumb/SportsTeam/SportsEvent/NewsArticle/CollectionPage، Sitemap index مقسم، `lastmod` فقط من timestamp معروف، internal linking وthin-content gates وSearch noindex.

- صفحات الأخبار بلا مصدر/محتوى تبقى noindex؛ فرق entity-only noindex؛ H2H تحت3 مواجهات ليس صفحة.
- `/search` يملك meta noindex؛ Robots يذكر `/search` غير المحلي، وقواعد خاصة بـGooglebot/Bingbot لها `allow:/` فقط، لذلك **لا يُعوّل على robots للحسابات**. noindex صريح لكل الصفحات الشخصية، X-Robots-Tag للـAPI، وعدم إضافتها للـSitemap هو الحل المعتمد دون إعادة بناء SEO.
- `NEXT_PUBLIC_SITE_URL` لم يُضبط هنا؛ الإنتاج/Search Console/الفهرسة الفعلية وCore Web Vitals غير قابلة للإثبات من checkout. لا وعود ترتيب.

## 6. Vercel والإعدادات والأمان والتشغيل

- `vercel.json`: Cron واحد `0 6 * * *` لـ`/api/cron/warm`؛ لا تبديل لخطة مدفوعة.
- أغلب Route Handlers Node.js؛ `/api/live/report` Edge قائم (البناء يعطي تحذير deprecation فقط).
- `.env.example` يوثق المزودين، NEWS، SEO، CRON_SECRET، DIAGNOSTICS_TOKEN، وإعدادات live_* الاختيارية. لا متغيرات accounts عامة حاليًا، ولا قيم أسرار محلية مكشوفة/مضافة.
- **خطة الإنتاج Hobby/Pro غير معروفة**. مراجعة [وثيقة Vercel Hobby الرسمية](https://vercel.com/docs/plans/hobby) بتاريخ الفحص تؤكد أنها personal/noncommercial؛ أي استخدام تجاري يحتاج قرار خطة. لا نفترض أن Vercel يوفر DB تلقائيًا.
- Headers أمان `nosniff`/Referrer/Permissions وframe protection بالإنتاج، allowlist للـpreview host `*.e2b.app` موجودة. CSP خاص بالبث لا بالصفحات الأخرى.
- `ratelimit.ts` الحالي per-instance ويعفي crawler UA ويثق forwarded IP؛ **غير كافٍ لحماية تسجيل الدخول**، لذلك لا يُكرر كنظام حسابات. مصادقة عامة تحتاج حدود موثوقة/دائمة دون crawler bypass، CSRF/origin، httpOnly، validation، حماية RLS والتأكد من المستخدم خادميًا.
- `log.ts` JSON+redaction، `circuit.ts`، `/api/health` وdiagnostics محمي، reconciliation/provenance/stale checks موجودة. مراقبة أخطاء حسابات/مزامنة غير موجودة. لا analytics تتبع للمستخدمين.
- PWA **موجودة** Manifest+SW؛ SW لا يخزن APIs ولا صفحات النتائج الحية، fallback offline واضح. لا Push إرسال ولا permission prompt. لا حاجة لإعادة تنفيذها في المرحلة الأولى.
- notifications: vocabulary/quiet-hours/dedup pure helpers وAPI اشتراكات ذاكرة فقط. **ليست In-app UI أو delivery حقيقيًا**؛ API يصرح `persistent:false,pushActivated:false`. DELETE بهوية device مقدمة من العميل لا يملك صلاحيات حساب؛ لا يُستخدم للبيانات الشخصية. الإصلاح/التسليم للمرحلة2، دون ادعاء عمل تنبيهات الآن.

## 7. الاختبارات والـbaseline الفعلي

| الأمر (أُجري قبل أي تعديل كود) | النتيجة في 2026-10-01 |
|---|---|
| `npm ci --no-audit --no-fund` | ✅ تثبيت405 package، لم تتغير ملفات التبعيات. تحذير دعم ESLint موجود مسبقًا. |
| `npm run typecheck` | ✅ exit0 |
| `npm run lint` | ✅ exit0، بلا أخطاء أو تحذيرات lint |
| `npm test` | ✅ **151/151** في23 ملفًا. تحذير MODULE_TYPELESS موروث؛ لا فشل/تخطي. |
| `npm run live:validate` | ✅ القوائم الفارغة صحيحة:0 matches/streams/channels |
| `npm run build` | ✅ exit0، جميع routes القائمة بُنيت دون مفاتيح. تحذير Edge runtime موروث فقط. |
| أدوات المتصفح | `@playwright/test` موجود؛19 سيناريو E2E للبث + fixture منعزلة. لا اختبارات تخصيص/حسابات. |
| `npx playwright install chromium` | ❌ CDN غير قابل للوصول من shell (`ECONNRESET`). لم أزعم نجاح E2E؛ ستُجرّب وسيلة متصفح بديلة قبل تسليم المرحلة1. |

## 8. مصفوفة الموجود/الناقص — مرجع منع إعادة التنفيذ

| ✅ موجود ويعمل في baseline (لا يُعاد) | ❌ غير موجود / ناقص |
|---|---|
| Next App Router، shell، هوية KoraScore، RTL/LTR داكن | مفضلة فرق/بطولات/لاعبين، تخزين زائر موثق |
| سلاسل المباريات/الترتيب/الفرق/الهدافين + stale/cache | تخصيص الصفحة الرئيسية كسطح منعزل/كسول |
| Slug entities + بدائل عربي/إنجليزي + البحث الموحّد | ملفات شخصية ومصادقة عامة وجلسات واستعادة/حذف حساب |
| News Hub/Entity filters/Dedup/Clustering/Attribution | أخبار حسب الاهتمامات (تستعمل pipeline الموجود، لا pipeline جديد) |
| H2H والجدول التاريخي والأرشيف | مقارنة فريقين موسمية/لاعبين (H2H ليس هذه المقارنة) |
| مركز مباراة بالنتيجة/حالة/أحداث/روابط H2H/تفاصيل | حفظ مباراة، تنبيه مباراة، إحصائيات/تشكيلات حين يتيح المصدر فقط |
| نموذج إشعارات pure واشتراكات تجريبية غير دائمة | In-app inbox حقيقي؛ مزامنة متعددة الأجهزة؛ push delivery |
| PWA + offline، اختيار لغة/وقت | ربط إعدادات اللغة/الوقت بالحساب؛ خيارات privacy شخصية |
| SEO metadata/sitemaps/robots/noindex search | noindex صريح لكل صفحة شخصية جديدة |
| Health/diagnostics/logging، unit/E2E tools، lint/type/build | اختبارات وظائف المرحلة1 + مراقبة مزامنة/مصادقة |
| التقويم وتبديل مصادر البث الرسمي opt-in | توقعات/شارات/تحديات (مرحلة4 مؤجلة)؛ analytics عامة (مرحلة5) |

## 9. قرار البنية/التكلفة قبل اعتماد الحسابات

راجعنا الوثائق الرسمية عبر أداة HTTPS بتاريخ الفحص، دون إنشاء اشتراك أو إرسال بريد أو تخزين أي مستخدم:

1. [Supabase pricing](https://supabase.com/pricing): Free **$0/شهر**،50,000 MAU،DB500MB،egress5GB،مشروعان نشطان، pause بعد أسبوع عدم نشاط؛ Pro يبدأ$25/شهر **ولا نعتمده افتراضيًا**.
2. [Supabase SSR/Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs): متوافق App Router وProxy/Route Handlers. عدم الثقة بـgetSession وحده، والتأكد من المستخدم/claims؛ كل بيانات المستخدم `private,no-store` دون CDN cache.
3. [Supabase password security](https://supabase.com/docs/guides/auth/password-security): bcrypt+salt في Auth. لا تخزين/Hashing منزلي داخل المشروع.
4. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp): البريد الافتراضي **ليس للإنتاج**؛ عناوين أعضاء المشروع فقط و2 رسالة/ساعة. التسجيل المؤكد/استعادة كلمة المرور للجمهور تحتاج **custom SMTP**.
5. [Resend pricing](https://resend.com/pricing): بديل SMTP منخفض التكلفة Free$0،3,000 رسالة/شهر،100/يوم. يحتاج domain verification وضبط DKIM/SPF وقرار المشغّل؛ لا إضافة SDK أو خدمة إرسال مستقلة افتراضيًا ولا تفعيل overages.

**البديل بلا خدمة/بلا تكلفة:** المفضلة واللوحة وملف زائر محلي الآن، وتأجيل الحسابات والمزامنة إلى قرار قاعدة بيانات/SMTP. **يتطلب قرارًا/بنية إضافية** (ويمكن أن يكون بلا دفع ضمن حدود Free). التفعيل الفعلي والـSMTP وOAuth Google لا يمكن اختبارها ضد إنتاج بلا إعدادات وموافقة؛ لا نعد بها جاهزة بمجرد نجاح build.

## 10. خطة المرحلة الأولى بعد هذا التوثيق

1. إنشاء طبقة تفضيلات محدودة/versioned تتحقق من المدخلات؛ بيانات كرة القدم تأتي من الكتالوج/المزوّدين القائمين فقط. add/remove على entity ids ومعرف لاعب حقيقي، لا اختراع صفحات/إحصائيات.
2. أزرار متابعة في صفحات الفرق/البطولات واللاعبين المتاحين، ملف واحد منظم AR/EN، empty/error/loading وحالة التخزين، إيقاف التخصيص ومسح التفضيلات.
3. لوحة منزلية كسولة: لا اتصال شخصي/DB ولا provider fan-out للزائر بلا اهتمامات؛ إعادة استخدام الخدمات والقواميس والـTTL؛ no-store للنتائج الشخصية؛ الحفاظ على الصفحة العامة كاملًا.
4. اختيار الحسابات **بعد قرار المستخدم**: وضع محلي فقط أو تكامل Supabase opt-in مع schema/RLS+SSO/email/session/delete والمزامنة الأساسية ضمن متطلبات المرحلة1؛ لا إعادة استعمال live-admin ولا تفعيل paid infrastructure.
5. فحوص build/typecheck/lint/unit/live:validate، E2E جديدة + القديمة، smoke HTTP/SEO/RTL/موبايل، تقرير تسليم يفرق بين local/mock والاختبارات الحقيقية لخدمة خارجية.
6. **التوقف بعد تقرير المرحلة1.** حفظ المباريات وIn-app delivery والمقارنات والتحسينات التحليلية/المجتمعية والنضج تبقى مراحل لاحقة. لا مربع نجاح لميزة مؤجلة.

## 11. القرار المعتمد بعد الفحص وقبل تنفيذ المرحلة الأولى

اختار المستخدم في سؤال البنية خيار **`local-first`**: تنفيذ المفضلة وملف الزائر والرئيسية المخصصة محليًا الآن، بلا إنشاء خدمات أو اشتراكات جديدة. **تؤجّل الحسابات وGoogle/البريد واستعادة/حذف الحساب والمزامنة بين الأجهزة** إلى اعتماد بنية منفصلة؛ لا شاشة تسجيل صورية ولا استعمال لجلسة إدارة البث كحساب زائر. التسجيل ليس شرطًا للتصفح العام.

تظل المراحل 2–5 خارج هذا التنفيذ. هذا ملحق قرار، وليس إعادة صياغة للـbaseline أعلاه؛ الأساس تأكد لاحقًا بـ`git rev-parse HEAD` وهو `f263a0d52fa14cac5c0d573678382d94377684cd` على الفرع المذكور. تفاصيل التنفيذ والاختبارات النهائية في `docs/PERSONALIZATION-PHASE1-DELIVERY.md`.

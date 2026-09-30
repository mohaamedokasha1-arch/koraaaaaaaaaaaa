# ملحق الفهرسة والزحف — التقرير الكامل (قبل/بعد)

> المنهج: طلبات HTTP فعلية على الخادم المحلي (وضع الإنتاج `next build` + `next start`) بوكيل مستخدم Googlebot، مع فحص HTML الخام **بدون تنفيذ JavaScript**، ومقارنة مُخرجات قبل/بعد.

## المرحلة 1 — جرد أنواع الصفحات وقرار الفهرسة

| نوع الصفحة | نمط URL | طريقة التوليد | الغرض | القرار | قبل | بعد |
|---|---|---|---|---|---|---|
| الرئيسية | `/{locale}` | Dynamic (SSR) + Polling | قيمة | Index | Canonical → الرئيسية ✅ | Canonical ذاتي + hreflang ✅ |
| مباشر | `/{locale}/live` | Dynamic SSR + SWR 30ث | قيمة | Index | Canonical → الرئيسية ❌ | Canonical ذاتي ✅ |
| مباريات اليوم/الأمس/الغد | `/{locale}/today` | Dynamic SSR | قيمة | Index | Canonical → الرئيسية ❌ | Canonical ذاتي ✅ |
| النتائج | `/{locale}/results` | Dynamic SSR | قيمة | Index | Canonical → الرئيسية ❌ | Canonical ذاتي ✅ |
| المواعيد | `/{locale}/upcoming` | Dynamic SSR | قيمة | Index | Canonical → الرئيسية ❌ | Canonical ذاتي ✅ |
| الدوريات | `/{locale}/leagues` | Dynamic SSR | قيمة | Index | Canonical → الرئيسية ❌ | Canonical ذاتي ✅ |
| بطولة (تبويبات) | `/{locale}/leagues/{code}?tab=` | Dynamic SSR | قيمة + متغيّرات | Index (الأصل) — Variants → Canonical للأصل | لا قاعدة ❌ | كل التبويبات تُشير canonical للأصل ✅ |
| بطولة — مواسم سابقة | `/{locale}/leagues/{code}?tab=history&season=` | Dynamic SSR (بيانات تاريخية) | قيمة | Index على الأصل (Variants لا تُفهرس منفصلة) | غير موجود | ✅ مُضاف + Canonical للأصل |
| الترتيب | `/{locale}/standings?league=` | Dynamic SSR | قيمة + فلتر | Index (القاعدة) وفلتر → Canonical | لا قاعدة ❌ | ✅ |
| الهدافون | `/{locale}/top-scorers?league=` | Dynamic SSR | قيمة + فلتر | Index (القاعدة) وفلتر → Canonical | لا قاعدة ❌ | ✅ |
| الفرق | `/{locale}/teams?league=` | Dynamic SSR | قيمة + فلتر | Index (القاعدة) وفلتر → Canonical | لا قاعدة ❌ | ✅ |
| فريق | `/{locale}/teams/{id}` | Dynamic SSR (بيانات مزوّد) | قيمة | Index عند وجود بيانات، Noindex عند فشل المزوّد | Canonical → الرئيسية ❌ | Canonical ذاتي + Noindex عند التعذّر ✅ |
| مباراة | `/{locale}/matches/{id}` | Dynamic SSR + تحديث 60ث | قيمة | Index عند وجود بيانات، Noindex عند التعذّر | Canonical → الرئيسية ❌ | Canonical ذاتي + Breadcrumb JSON-LD ✅ |
| أخبار | `/{locale}/news` | Dynamic SSR (Opt-in) | قيمة عند التفعيل فقط | Index عند وجود عناوين، **Noindex عند الفراغ/عدم التفعيل** | غير موجودة | ✅ بقاعدة صريحة |
| بحث داخلي | `/api/search` (JSON) | Dynamic API | وظيفي | لا يُفهرس (ليس صفحة HTML) | ✅ | ✅ + Rate limit |
| 404 | أي مسار غير معروف | Next not-found | تقني | 404 حقيقي + Noindex | 404 ✅ لكن بـCanonical للرئيسية ❌ | 404 + Noindex وبلا Canonical ✅ |

## المرحلة 2 — التوجيهات: قبل/بعد

### robots.txt
```diff
  User-Agent: *
  Allow: /
  Disallow: /api/
- Disallow: /_next/          ← كان يمنع Google من قراءة JS/CSS اللازمة للعرض
+ Disallow: /_next/image
+ Disallow: /_next/webpack-hmr
+ User-Agent: Googlebot
+ Allow: /
+ User-Agent: Bingbot
+ Allow: /
+ Host: {SITE_URL}
  Sitemap: {SITE_URL}/sitemap.xml
```
مبرر كل تغيير: `/api/` بلا قيمة بحثية ويُستهلك بالزحف؛ `/_next/image` و`webpack-hmr` تقنية داخلية؛ أما `/_next/static` (JS/CSS/الخطوط) **يجب أن يبقى مفتوحاً** لأن حجبه يمنع الفهم الصحيح للصفحة. أُضيف سطر Host وسماح صريح للزاحفين الأساسيين.

### noindex / Env
- **الإنتاج**: مفتوح بالكامل (لا `noindex` على أي صفحة قيمة).
- **المعاينة/التطوير**: أُضيف رأس `X-Robots-Tag: noindex, nofollow` يُفعَّل تلقائياً عندما `VERCEL_ENV !== 'production'` (لا يمكن أن يتسبب في حجب الإنتاج).
- لا يوجد Cloaking: البوت يرى ما يراه المستخدم.

### Middleware / Bot protection
- لا WAF ولا حجب بـUser-Agent في المشروع. الـMiddleware (`src/proxy.ts`) يوجّه فقط لإضافة اللغة ولا يعيد توجيه Googlebot خارج المسارات المتوقعة.
- Rate limiting الجديد على `/api/*` **يستثني الزاحفين المعروفين صراحةً** (Googlebot/Bingbot/…)، حتى لا يظهر 429 لأي زحف.

## المرحلة 3 — قابلية قراءة المحتوى (بدون JS)

| مسار فُحص | H1 في HTML الخام | محتوى أساسي | JSON-LD | الحالة |
|---|---|---|---|---|
| `/ar/live` | ✅ (قسم مباشر) | ✅ توصيف الحالة + عدّاد | 2 | ✅ |
| `/ar/leagues/EGY` | ✅ «الدوري المصري الممتاز» | ✅ + تبويب المواسم | 4 (WebSite/Organization/Breadcrumb + بيانات الصفحة) | ✅ |
| `/ar/matches/{id}` | — (تعذّر جلبه في هذه البيئة بلا شبكة) | الصفحة تعرض حالة "غير متاح" بأناقة | SportsEvent + BreadcrumbList | ✅ لا Soft-404 مفهرس |
| `/ar/news` | ✅ «أخبار كرة القدم» | حالة فراغ نظيفة + إسناد | Breadcrumb/CollectionPage | ✅ Noindex لأنها بلا بيانات |

كل العناوين والأوصاف والـCanonical وhreflang موجودة في HTML المُستلَم من الخادم (وليست مضافة بعد التحميل) — تم التحقق من ذلك بفحص النص الخام.

## المرحلة 4 — Sitemap

| البند | قبل | بعد |
|---|---|---|
| عدد الروابط | 38 | **40** (يضاف `/news` فقط عند تفعيل الأخبار) |
| x-default | ❌ | ✅ داخل `alternates.languages` |
| lastmod | ❌ مزيف (زمن الطلب لكل رابط) | ✅ محذوف (لا ادعاء تغيير غير حقيقي) |
| روابط لأخطاء/تحويلات | لا | ✅ لا تزال لا |
| صفحات منخفضة القيمة | لا | ✅ لا (لا تبويبات، لا فلاتر، لا نتائج بحث) |
| Sitemap Index | ملف واحد (40 رابط < الحد) | ملف واحد — التقسيم إلى Index يبدأ عند 50k رابط، وموثّق كخطوة قادمة |

## المرحلة 5 — الروابط الداخلية

- **Orphan Pages**: لا توجد. كل المسارات الجديدة (`/news`، تبويب المواسم) مرتبطة من التنقّل/البطاقة/التبويبات.
- **Broken Links (داخلية)**: لم يُرصد رابط داخلي مكسور بعد التصحيح؛ وصلات `dict.nav.*` كلها تُشير إلى مسارات موجودة، وأُضيف رابط الأخبار إلى قائمة الجوال وقائمة سطح المكتب.
- **Redirect Chains**: لا سلاسل — `/{path}` بلا لغة → إعادة توجيه واحدة (307) إلى `/{locale}/path`. الموقع لا يستخدم Redirects قديمة إطلاقاً (لم يُحذف أي مسار في هذه الجولة).
- **الربط المنطقي**: بطولة ← فرق ← لاعبون ← مباريات ← أخبار: بطاقة المباراة تربط الفريقين والدوري؛ صفحة المباراة تربط الفريقين والدوري (كنص رابط وصفي)؛ صفحة البطولة تربط الفرق والمباريات؛ التنقّل يربط الأخبار.
- **Breadcrumbs مرئية** + `BreadcrumbList` مطابق على صفحات البطولة/الفريق/المباراة/الأخبار.

## المرحلة 6 — الصفحات الضعيفة (Thin Content)

| الحالة | القاعدة المطبقة |
|---|---|
| تبويب مواسم لبطولة بلا مجموعة بيانات | **لا يُنشأ ولا يُعرض التبويب** (قائمة البطولات المدعومة صريحة داخل `historical.ts`) |
| تبويب مواسم بلا بيانات (فشل الجلب) | يُعرض التبويب مع حالة فراغ نظيفة، والـCanonical للأصل، وليس في الـSitemap |
| صفحة أخبار بلا عناوين | `noindex, follow` + حالة فراغ + خارج الـSitemap |
| صفحات تعذّر فيها مزوّد مؤقتاً | `noindex` تلقائي (لا نسخة ناقصة تُفهرس) |
| فلاتر `?league=` والتبويبات | تُفهرس قاعدتها فقط (Canonical ذاتي للقاعدة) |
| ترقية تلقائية لصفحة أخبار | بمجرد وجود عناوين ⇒ تُصبح `index` ويدخل `/news` الـSitemap تلقائياً (قاعدة واحدة موثّقة، بلا تدخل يدوي) |

## المرحلة 9 — نتائج الزحف: قبل / بعد (نموذج مُقاس فعلياً)

| المسار | الحالة | Canonical قبل | Canonical بعد | hreflang بعد |
|---|---|---|---|---|
| `/ar` | 200 | `/ar` | `/ar` | ar/en/x-default |
| `/en` | 200 | `/en` | `/en` | ar/en/x-default |
| `/ar/live` | 200 | ❌ `/ar` | ✅ `/ar/live` | ✅ |
| `/ar/today` | 200 | ❌ `/ar` | ✅ `/ar/today` | ✅ |
| `/ar/results` | 200 | ❌ `/ar` | ✅ `/ar/results` | ✅ |
| `/ar/upcoming` | 200 | ❌ `/ar` | ✅ `/ar/upcoming` | ✅ |
| `/ar/leagues` | 200 | ❌ `/ar` | ✅ `/ar/leagues` | ✅ |
| `/ar/leagues/EGY` | 200 | ❌ `/ar` | ✅ `/ar/leagues/EGY` | ✅ |
| `/ar/leagues/EGY?tab=history` | 200 | — | ✅ `/ar/leagues/EGY` | ✅ |
| `/ar/standings` | 200 | ❌ `/ar` | ✅ `/ar/standings` | ✅ |
| `/ar/top-scorers` | 200 | ❌ `/ar` | ✅ `/ar/top-scorers` | ✅ |
| `/ar/teams` | 200 | ❌ `/ar` | ✅ `/ar/teams` | ✅ |
| `/ar/news` (غير مفعّل) | 200 | — | ✅ ذاتي + `noindex, follow` | ✅ |
| `/ar/teams/bad` | **404** | ❌ `/ar` | ✅ بلا Canonical + `noindex` | — |
| `/ar/missing` | 404 | — | بلا Canonical + `noindex` | — |
| `/robots.txt` | 200 | — | `/_next/` لم يعد محجوباً | — |
| `/sitemap.xml` | 200 | 38 رابطاً بلا x-default | 40 رابطاً + x-default، بلا lastmod مزيف | — |

قياسات أخرى: حجم JS للعميل **189,109 B ← 189,123 B** (فرق +14 بايت مضغوط؛ كل الكود الجديد على الخادم)، وزمن TTFB المحلي للصفحات المخدومة من الـCache 15–33 ms.

## ما لم أستطع التحقق منه (صراحةً)

1. **حالة الفهرسة الفعلية داخل Google** (Search Console) — لا وصول لها من هنا.
2. **Core Web Vitals الميدانية** (CrUX/Lighthouse في متصفح حقيقي) — لا متصفح ولا شبكة في البيئة.
3. **سلوك المزوّدين الحيّين على Vercel** — لا شبكة صادرة ولا مفاتيح هنا؛ ما فُحص هو بنية الكود ومسارات الفشل (التي تعمل: 503 من `/api/health`، حالات فراغ نظيفة، Stale fallback).
4. **تشغيل Cron على Vercel** — يحتاج نشر فعلي.
5. **محلّلات المصادر الجديدة مقابل الاستجابات الحقيقية وقت التشغيل** — تم التحقق من شكل البيانات عبر طلبات فعلية (انظر `SOURCE-EVALUATION.md`)، والتحقق الحسابي عبر اختبارات الوحدة (10/10) التي التقطت فعلاً خطأً في تحليل تاريخ Football.TXT قبل الدمج.

### خطوات تحقق يدوية بعد النشر (لك)

1. `Search Console → URL Inspection` للمسارات: `/ar/live`، `/ar/leagues/EGY`، `/ar/today` وتأكيد: Canonical ذاتي، hreflang متبادل، الزحف مسموح، لا `X-Robots-Tag`.
2. `Rich Results Test` على صفحة مباراة (SportsEvent + BreadcrumbList) وصفحة بطولة (BreadcrumbList).
3. `PageSpeed Insights` على `/ar` و`/ar/live` (جوّال) وتسجيل LCP/CLS/INP، ومقارنتها بما ستقيسه لاحقاً.
4. `Coverage/Pages` في Search Console: متابعة خروج الصفحات التي كانت تُشير canonical للرئيسية من حالة "Duplicate/Alternate canonical" خلال أسابيع.
5. فحص رابط معاينة Vercel (`.vercel.app`) والتأكد من وجود `X-Robots-Tag: noindex`، وأن الإنتاج بلا الرأس.
6. عند تفعيل `NEWS_FEEDS`: تأكيد شروط الناشر كتابةً قبل التشغيل، ثم مراقبة `/news` في Search Console.

# قائمة تحقّق SEO — تطبيق دليل «ضبط SEO لموقع كورة» على هذا المشروع

> هذا المستند يربط كل بند من دليل ضبط SEO (Next.js App Router على Vercel) بما يقابله **فعلياً** في هذا
> المستودع. المشروع ليس `app/match/[slug]` بسيطاً: فيه لغتان (`/ar`، `/en`)، ومسارات تحت
> `[locale]`، ومزوّدو بيانات متعددون (football-data، api-football، TheSportsDB، ESPN، openfootball).
> لذلك طُبّقت القواعد **بما يناسب هذا الهيكل** بدل نسخ الملفات كما هي.
>
> آخر تحديث: أُضيفت صورة المشاركة الافتراضية، وصحة الدومين، و404 حقيقي مُصيَّر على الخادم،
> وأداة فحص حيّة (`npm run seo:check`).

---

## 1) المتغيرات البيئية (§1 من الدليل)

| المتغير | الحالة | الملاحظة |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ موجود | في `.env.example` + **تحذير وقت البناء** في `next.config.mjs` إذا كان الإنتاج يشير إلى localhost أو `*.vercel.app`. |
| `GOOGLE_SITE_VERIFICATION` | 🆕 **أُضيف** | يُصدر `<meta name="google-site-verification">` من `src/app/[locale]/layout.tsx`. |
| مفتاح API | ✅ | `FOOTBALL_DATA_API_TOKEN` + مزوّدون اختياريون (لا علاقة له بالفهرسة). |

إضافة الفحص إلى المراقبة: `GET /api/health` يعرض الآن بند `seo.site_url` داخل `checks.items`
(مستوى `warn` عندما لا يكون الدومين https وإنتاجياً).

```bash
curl -s https://your-domain.com/api/health | jq '.checks.items[] | select(.id=="seo.site_url")'
```

---

## 2) الإعدادات العامة: `src/lib/seo.ts` (بديل `lib/site.ts`)

الدليل يقترح `SITE_URL` + `absoluteUrl()` + دوال مسارات. هنا الملف يؤدي الدور نفسه **ويزيد**:

- `localePath(locale, path)` — كل مسار يحمل اللغة (`/ar/live` ≠ `/en/live`).
- `languageAlternates(path)` — **hreflang متبادل + `x-default`** (الدليل لا يغطيها؛ المشروع ثنائي اللغة، وحذفها يعني أن Google يختار النسخة الخطأ).
- `pageMetadata({ locale, path, title, description, indexable, type, image })` — تُنشئ canonical ذاتياً
  مطلقاً + hreflang + OG + Twitter من مكان واحد.
- `breadcrumbJsonLd()` و`siteJsonLd()` و`clip()`.
- 🆕 `DEFAULT_OG_IMAGE` + `OG_IMAGE_WIDTH/HEIGHT` + `siteUrlProblem()`.

> ⚠️ قاعدة الدليل الذهبية مطبّقة: **لا `canonical` في الـ layout**. كان هذا الخطأ موجوداً سابقاً
> (كل الصفحات تُشير إلى `/ar`) وصُلح في `docs/INDEXING-AUDIT.md`؛ الكود يمنعه الآن بتعليق صريح
> في `src/app/[locale]/layout.tsx`.

---

## 3) طبقة البيانات (§3)

بدل `lib/data.ts` يوجد `src/lib/football.ts` + `src/lib/providers/*` مع:

- سلاسل fallback بين المزوّدين + Circuit breaker (`src/lib/circuit.ts`).
- `reactCache` لتفادي تكرار الطلب بين `generateMetadata` والصفحة (`getMatchMemo`، `getTeamMemo`) —
  يقابل `cache()` في الدليل.
- **لا يُكسر الـ build عند فشل المزوّد**: الصفحة تعرض حالة فراغ أنيقة، و`generateMetadata` يُرجع
  `indexable: false` بدل نشر صفحة بلا بيانات.

---

## 4) الـ Sitemap (§4)

الدليل يقترح `app/sitemap.ts`. المشروع يستخدم **Sitemap Index** (وهو الأفضل هنا):

- `/sitemap.xml` → فهرس (`src/app/sitemap.xml/route.ts`) يشير إلى 6 ملفات أبناء.
- `/sitemaps/<type>.xml` → `static`، `leagues`، `teams`، `matches`، `news`، `archive`
  (`src/app/sitemaps/[type]/route.ts`).
- كل رابط يُسرد **للغتين** مع hreflang متبادل داخل الملف نفسه.
- `lastmod` حقيقي من وقت جلب البيانات (لم يُزوَّر بـ `new Date()`).
- لا روابط لصفحات fلاتر/تبويبات/بحث، ولا صفحة تُرجع 404.

🆕 **تحسين:** خريطة المباريات كانت تُبنى من الذاكرة المؤقتة فقط، أي أنها تُصبح **فارغة على أي
instance بارد** (أول زيارة من Googlebot قبل أي زائر). صارت الآن تجلب من المزوّدين مباشرة
(`getLiveMatches` + أمس/اليوم/غد) عندما تكون الذاكرة فارغة، مع ابتلاع أي خطأ.

حد الـ 50,000 رابط: التقسيم موجود مسبقاً عبر الـ Index، وكل ابن محدود بـ 400–5000 رابط.

---

## 5) robots.txt (§5)

`src/app/robots.ts`:

- ✅ `/_next/static` **غير محجوب** (مهم لعرض الصفحة) — محجوب فقط `/_next/image` و`/_next/webpack-hmr`.
- ✅ `Disallow: /api/` وفلاتر البحث (`/search`, `/*?q=`, `/*?tab=`…).
- ✅ `Sitemap:` و`Host:`.
- ✅ المعاينات تُمنع برأس `X-Robots-Tag` من `next.config.mjs` (أفضل من `Disallow` في robots: الصفحة
  المحجوبة لا تُقرأ، وبالتالي لا يُرى الـ noindex أصلاً).
- 🆕 رأس `X-Robots-Tag: noindex, nofollow` دائم على `/api/:path*` (يغطي أيضاً صفحات خطأ Next التي
  قد يُصدرها مسار API كـ HTML).

---

## 6) الـ Layout الجذري (§6)

`src/app/[locale]/layout.tsx`:

- `metadataBase` من `SITE_URL` (مصدر واحد مشترك مع canonical وsitemap).
- `title.template` + `description` + OG/Twitter + `viewport` + `themeColor`.
- ✅ **لا canonical** (انظر §2).
- 🆕 `verification.google` من `GOOGLE_SITE_VERIFICATION`.
- 🆕 صورة مشاركة افتراضية `public/og-default.png` (1200×630) في `openGraph.images` و`twitter.images`.
- JSON-LD للموقع (`WebSite` + `Organization` + `SearchAction`) يُصدر مرة واحدة.
- `<html lang dir>` الصحيح لكل لغة.

---

## 7–9) الصفحات (الرئيسية، المباراة، الدوري)

| الدليل | هذا المشروع |
|---|---|
| `app/page.tsx` | `src/app/[locale]/page.tsx` |
| `app/match/[slug]/page.tsx` | `src/app/[locale]/matches/[id]/page.tsx` (+ `h2h/[a]/[b]`) |
| `app/league/[slug]/page.tsx` | `src/app/[locale]/leagues/[code]/page.tsx` (+ `archive/[[...season]]`) |
| — | زيادة: `live`، `today`، `results`، `upcoming`، `standings`، `top-scorers`، `teams/[id]`، `news`، `search`، `watch` |

القواعد المطبّقة على كل صفحة:

1. canonical ذاتي مطلق + hreflang (عبر `pageMetadata`).
2. عنوان/وصف **فريدان** لكل صفحة (من قاموس الترجمة + بيانات المباراة/الدوري).
3. `notFound()` عند غياب البيانات ⇒ حالة 404 حقيقية (لا Soft 404).
4. `noindex` تلقائي عند تعذّر المزوّد أو فراغ الصفحة (أخبار غير مفعّلة، فريق بلا بيانات).
5. JSON-LD مطابق لما يُعرض: `SportsEvent` + `BreadcrumbList` للمباراة، `BreadcrumbList` للدوري والفريق،
   `WebSite/Organization` في الـ layout.
6. الفلاتر والتبويبات (`?tab=`، `?league=`، `?season=`) تُشير canonical إلى أصلها ولا تُدرج في الـ sitemap.

🆕 صار عنوان URL في JSON-LD للمباراة يُبنى عبر `absoluteUrl(localePath(...))` بدل قراءة
`process.env.NEXT_PUBLIC_SITE_URL` مباشرة (توحيد المصدر، وتفادي رابط ناقص عند غياب المتغير).

---

## 10) مكوّن JSON-LD

موجود كـ `<script type="application/ld+json">` مُضمّن في الصفحات (المشروع لا يستخدم مكوّناً منفصلاً).
إن أردتِ مكوّناً موحّداً كما في الدليل، انسخي هذا الملف:

```tsx
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
```

> ملاحظة أمان: المخرجات الحالية تمرّ عبر `JSON.stringify` مباشرة داخل صفحات مُصيَّرة على الخادم من
> بيانات مزوّدين خارجيين. استبدالها بالمكوّن أعلاه (يهرب `<`) أأمن — خطوة مقترحة لاحقاً.

---

## 11) صفحة 404 (§11) — 🆕 أُصلحت

كانت أي رابطة مجهولة (مثل `/ar/does-not-exist`) تُجاب بصفحة Next الافتراضية الإنجليزية: حالة 404 صحيحة
لكن بلا تنقّل ولا لغة. والأسوأ: صفحات `notFound()` داخل `[locale]` تُبنى كـ RSC payload ويُصيَّر
محتواها **على العميل** — أي جسم HTML فارغ لمن لا ينفّذ JavaScript (خطر Soft 404).

الحل المطبّق: `src/app/not-found.tsx` على الجذر — صفحة ثابتة **مُصيَّرة على الخادم**، بهيدر/فوتر
الموقع، ونص عربي/إنجليزي، وروابط رجوع، مع:

- حالة HTTP `404`،
- `<meta name="robots" content="noindex">` (من Next + من `metadata` الصريح)،
- عنوان localized.

---

## 12) إعدادات البناء: `next.config.mjs`

| البند | الحالة |
|---|---|
| `poweredByHeader: false` | 🆕 أُضيف |
| `trailingSlash: false` | 🆕 أُضيف (رابط واحد لكل صفحة) |
| `reactStrictMode` | ✅ موجود |
| منع `/api/` | 🆕 رأس `X-Robots-Tag` دائم |
| حماية المعاينات | ✅ `X-Robots-Tag` كامل الموقع عندما `VERCEL_ENV !== 'production'` |
| CSP لبث المباريات | ✅ موجود مسبقاً |
| `typescript.ignoreBuildErrors` / `eslint.ignoreDuringBuilds` | ✅ **غير مستخدمين** |

---

## 13) فحص ما قبل النشر (§13) — 🆕 أداة جاهزة

```bash
npm run typecheck      # tsc --noEmit
npm run lint
npm run build
npm run seo:check -- https://your-domain.com
```

`scripts/seo-check.mjs` يفحص نطاقاً منشوراً فعلياً (بـ User-Agent جوجل بوت):

- حالة HTTP لكل صفحة + صفحة مفقودة (يجب 404 + noindex)،
- canonical: موجود، مطلق، على نفس النطاق، **ذاتي المرجع**،
- hreflang `ar`/`en` + `x-default`،
- `noindex` في الميتا أو في رأس `X-Robots-Tag`،
- العنوان والوصف و`og:image` وJSON-LD و`<h1>`،
- robots.txt: لا يحجب `/_next/static`، ويُعلن `Sitemap`،
- `/sitemap.xml`: XML صالح، كل الروابط على نفس النطاق، والأبناء + عيّنة من الروابط تُفتح فعلاً (200)،
- `/api/*` يحمل `noindex`، والـ HTML لا يحمله،
- تحويل `www` ⇄ النطاق الأساسي.

المنطق في `src/lib/pure/seoCheck.ts` (نقي، بلا I/O) مع 14 اختباراً في `tests/seoCheck.test.mjs`،
حتى تكون النتائج قابلة للتحقق لا مجرد طباعة. يخرج الكود `1` عند وجود أي فشل (مناسب لـ CI).

---

## 14) خطوات Google Search Console (§14)

1. **Domain property** عبر سجل DNS TXT (يغطي http/https وwww وبدونه).
2. أرسلي `sitemap.xml` فقط — الفهرس يكشف الأبناء تلقائياً.
3. **URL Inspection** على `/ar`، `/ar/live`، ثم **Request Indexing**.
4. راقبي تقرير **Pages**:
   - `Discovered – currently not indexed` ⇒ محتوى/عمر دومين، وليس مشكلة تقنية (كل العقبات المذكورة أعلاه مُزالة).
   - `Duplicate without user-selected canonical` ⇒ راجعي الـ canonical (الأداة تكشفه).
   - `Soft 404` ⇒ يجب أن تختفي: لا توجد صفحة فارغة تُرجع 200 للمسارات المجهولة.
5. **Rich Results Test** على صفحة مباراة (`SportsEvent` + `BreadcrumbList`).

---

## 15) ما يؤثر فعلياً (§15)

- ✅ محتوى فريد لكل مباراة (أحداث، إحصائيات، تفاصيل) وليس جدولاً فقط.
- ✅ ربط داخلي: مباراة ⇒ الفريقان + الدوري + H2H؛ بطولة ⇒ الفرق والمباريات؛ تنقّل عام.
- ✅ `next/image` و`next/font` وPWA (manifest + service worker) وLCP مقاس سابقاً.
- ✅ صفحات المباريات المنتهية تبقى (مصدر زيارات «نتيجة مباراة …»).
- ⚠️ الروابط: معرّفات المباريات من المزوّدين (ليست slugs بصيغة `al-ahly-vs-zamalek-2025-05-10`)؛
  التوصية في الدليل ممتازة لكن تغييرها يتطلب خريطة معرّفات دائمة — **قرار مؤجّل لكِ**، وهو لا يمنع
  الفهرسة لأن الروابط ASCII ثابتة بالفعل.
- 🆕 صورة مشاركة افتراضية: يمكن استبدال `public/og-default.png` بتصميم يحمل الشعار (نفس المقاس
  1200×630) دون تعديل أي كود.

---

## خطوات Vercel اليدوية المتبقية (لا يمكن تنفيذها من المستودع)

1. **Settings → Domains**: اجعلي الدومين المخصص أساسياً، والنسخة الأخرى تُحوّل إليه (308/301).
2. **Settings → Environment Variables → Production**:
   `NEXT_PUBLIC_SITE_URL=https://your-domain.com` (ثم **أعدي النشر**: قيم `NEXT_PUBLIC_*` تُدمج وقت البناء)،
   و`GOOGLE_SITE_VERIFICATION` إن استخدمتِ التحقق بالميتا.
3. **Deployment Protection**: مفعّل للمعاينات فقط، وموقوف للإنتاج (وإلا يرى Google شاشة تسجيل دخول).
4. **Cron**: `/api/cron/warm` يومياً 06:00 (معرّف في `vercel.json`) لتسخين الذاكرة قبل ذروة الزيارات.
5. بعد النشر: `npm run seo:check -- https://your-domain.com` يجب أن يخرج `0 fail`.

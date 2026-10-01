# تقرير التحقق — 2026-10-01

التنفيذ على `arena/01a0f4fc-koraaaaaaaaaaaa`؛ هذا التقرير يوثّق التحقق المحلي قبل نشر pull request، ولا يحكم على نتائج GitHub CI أو نشر Vercel بعده. أُتيحت عند التحقق معاينة محلية ببناء إنتاجي مفعّل على منفذ 3000 (`/ar/watch` و`/en/watch`). الكتالوج وwhitelist والاكتشافات الإنتاجية بقيت فارغة؛ هذه ليست تجربة بث مرخّص حقيقي.

## بوابات المراحل

| المرحلة | التحقق المنفّذ |
| --- | --- |
| 1 — العقود/السياسة/fallback | validator، الأنواع، lint، 103 اختبارات Node، build ناجح |
| 2 — الواجهة والمشغلات/ISR | الأنواع، lint، 105 اختبارات، build مفعّل ناجح |
| 3 — التخزين/التقارير/الإدارة/الاكتشاف | validator، الأنواع، lint، 119 اختبارًا، build مفعّل ناجح |
| 4 — اختبارات المتصفح/الأمان/الأداء | validator، الأنواع، lint، **124 اختبارًا بلا فشل أو skip**، **12/12 Playwright**، build نهائي والعلم مغلق ثم مفتوح |

`npm audit`: **0 vulnerabilities** (فُحصت التبعيات كلها وكذلك production-only). `git diff --check` ناجح.

### أوامر التحقق النهائية

```bash
npm run live:validate
npm run typecheck
npm run lint
npm test
NEXT_PUBLIC_LIVE_ENABLED=false npm run build
NEXT_PUBLIC_LIVE_ENABLED=true npm run build
npm run test:e2e
npm audit
```

في sandbox تعذر تنزيل Chromium من CDN؛ استُخدم Chromium موجود مؤقتًا خارج dependencies المشروع:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium \
LD_LIBRARY_PATH=/tmp/al2023/lib FONTCONFIG_PATH=/tmp/fonts npm run test:e2e
```

أمان المتصفح طبيعي: لم يُعطّل web security أو CORS. mock HLS وتجاوز native canPlayType خاصان بتطبيق Playwright المعزول، لا بالتطبيق الإنتاجي.

## تغطية المتصفح (12 اختبارًا)

1. aliases، RTL، كتالوج فارغ صادق، الصفحات القانونية، وإدارة غير مهيأة 404.
2. mobile بلا overflow أفقي وتبديل اللغة يحفظ المسار.
3. صفر طلبات فيديو/provider قبل click؛ خطأ YouTube ينتقل للبديل ويسجل نجاح تشغيل فعلي.
4. كل المصادر تفشل: محاولتان لكل مصدر، توقف، ثم retry صريح بجولة جديدة.
5. HLS fatal media error: recovery واحدة، ثم انتقال بعد fatal ثانٍ.
6. iframe لا يصل load event: مهلة 12 ثانية والانتقال.
7. iframe وصل load فقط: ليس ادعاء تشغيل أخضر؛ إقرار المستخدم مطلوب.
8. external-only: لا مشغّل؛ Watch anchors أشقاء لبطاقة النتائج وليسوا anchors متداخلة.
9. ICS بوقت UTC، وتبويبات المباراة تعمل بلوحة المفاتيح.
10. مرشحات الفريق/البطولة تستخدم JSON/CDN، لا API قراءة جديدًا.
11. polling الكتالوج والنتائج يتوقف عند hidden ويعود عند visible.
12. توقيت البث يتبع cookie الموقع (UTC/Dubai)، بينما ICS يبقى UTC.

النتيجة النهائية: **12 passed، 32.1 ثانية**. مصادر الفيديو وأخطاء API في هذه الاختبارات doubles/fixtures؛ ليست إثباتًا لإتاحة YouTube/Twitch/HLS/Scorebat حقيقية أو ترخيصها.

## PostgreSQL، الأمان وحدود الاستخدام

`scripts/live/check-sql.mjs` شُغّل على PGlite بقاعدة داخل الذاكرة: **24 تحققًا ناجحًا**.

- الهجرة تتكرر بأمان؛ السجل الابتدائي فارغ وصحيح.
- anon يقرأ الكتالوج ولا يكتب أو يقرأ هويات التقارير ولا يشغّل RPC.
- service_role: حفظ revision، بلاغ صحيح، duplicate بلا زيادة، unknown source، وحد مشترك 5/10 دقائق.
- خمسة hashes مختلفة تُخفي المصدر مؤقتًا؛ لا هوية تُعرض في الكتالوج.
- التقارير لا تزيد curation revision؛ حفظ المحرر القديم يحفظ العدادات، والـrevision القديم يُرفض.
- استبدال فيديو/provider/match أو حذف المصدر يمسح أحداث البلاغ القديم ولا ينقل إخفاءه للمصدر الجديد.
- حفظان بrevision واحدة: واحد فقط ينجح. PGlite اتصال داخلي واحد، ولذلك هذا فحص semantics لا اختبار PostgreSQL متعدد الاتصالات تحت حمل فعلي.
- تنظيف قديم عند كتابة مقبولة؛ cap للاكتشاف 96 محاولة يومية.

أضيف اختبار حماية معرّفات المصادر مثل `__proto__` و`constructor`: عدادات صريحة آمنة، فلا تسمح قيم Object prototype بتجاوز الحد أو حلقات fallback. كما يُرفض الاعتماد على IP headers غير موثوقة؛ خارج Vercel يلزم proxy مع تهيئة صريحة أو bucket محافظ مشترك.

**لم يُنفّذ SQL أو load test على مشروع Supabase حقيقي.** يلزم التحقق من anon/RPC/JWT، النطاق، التزامن والميزانية على مشروعك قبل الإطلاق.

## ISR/HTTP/feature flag

- `.next/prerender-manifest.json`: صفحات `ar/en watch` وcopyright/disclaimer كلها `initialRevalidateSeconds=60`.
- detail route مُصنّف SSG مع `dynamicParams=true` و`revalidate=60`؛ catalog فارغ يعني بلا معرفات مسبقة. طلب المعرف غير الموجود يرجع 404 cached وفق ISR. لا نعتبر حقل manifest داخليًا غير موجود إثباتًا أو فشلًا لـISR.
- عند التفعيل: hub `200` و`Cache-Control: s-maxage=60`؛ إدارة غير مهيأة `404/no-store`، معرف غير موجود `404`.
- `/live/catalog.json`: `public,max-age=30,s-maxage=60,stale-while-revalidate=60`.
- فُحص بناء مغلق عبر HTTP: hub/legal/admin `404`، لا روابط watch في shell، وreport `404/no-store` مع `error=disabled`.
- CSP على watch يسمح فقط frame hosts الموثوقة. HLS allowlist فارغة، ولم يُفتح نطاق عام أو video proxy.
- dry run للاكتشاف ناجح: **0 طلبات API، 0 كتابة ملفات/DB، 0 مرشحين**. لم تُشغّل الأتمتة فعليًا على مفاتيح أو حسابات حقيقية.

## أداء وإتاحة

Lighthouse mobile، `/en/watch`، بناء production النهائي، Chromium 153، جهاز مختبري مع simulated throttling؛ القياس النهائي بلا اختبارات/TypeScript تعمل بالتوازي:

| المقياس | النتيجة |
| --- | --- |
| Performance | **96/100** |
| Accessibility | **100/100** |
| Best practices | **100/100** |
| SEO | **100/100** |
| FCP | 1.0 s |
| LCP | 2.6 s |
| Total Blocking Time | 90 ms |
| CLS | 0.001 |
| JavaScript transfer | 194,589 bytes |

أُصلح تباين النص الجديد ورابط breadcrumb غير المميز. استُخدمت Zod imports مسماة قابلة للـtree-shaking بدل namespace الكبيرة، مع بقاء التحقق نفسه ونجاح جميع الاختبارات؛ JS transfer في هذه المقارنة انخفض من 254,822 إلى 194,589 بايت (~24%). قياسات الأداء السابقة تأثرت بعمل متزامن في sandbox، فلا نستنتج منها تحسنًا ميدانيًا مضمونًا.

هذه **قياسات lab لكتالوج فارغ**، وليست أداء صفحة مليئة بالمصادر أو الفيديو أو بيانات INP حقيقية. LCP 2.6 s قريب من حد 2.5 s وليس ضمن «good» بهذه القراءة؛ أعد الفحص على Preview/أجهزة فعلية ومصادر حقيقية، وراقب Web Vitals بعد وجود زيارات. لا وعود بوصول جميع المشاهدين إلى هذه الأرقام.

رُوجعت لقطات desktop/mobile بالعربية؛ لا overflow عند 1440 و390 px. استُخدم خط عربي مؤقت للـQA بسبب نقص خطوط sandbox، ولم يُضف dependency/تحميل خط خارجي للتطبيق.

## حدود الطبقة الأصلية

هذا الأمر نجح بلا diff:

```bash
git diff --exit-code -- src/lib \
  'src/app/[locale]/live' 'src/app/[locale]/matches' 'src/app/[locale]/results' \
  src/app/api/matches
```

لم تتغير facade/types/providers/cache/store/normalization أو صفحة النتائج/التفاصيل أو `/api/matches/live`. التكامل الوحيد مع بطاقة النتائج رابط Watch شقيق، ومع shell التنقل/footer/timezone presentation. القائمة الكاملة: [CHANGES.md](./CHANGES.md).

## تحذيرات ومتبقي إطلاق فعلي

- Next 16.3.8 يطبع تحذير deprecation لـEdge Runtime؛ البناء ناجح. الـreport الآن Edge كما في الخطة؛ راجع التحويل إلى nodejs عند ترقية Next التي تزيل Edge.
- Node يطبع `MODULE_TYPELESS_PACKAGE_JSON` عند تشغيل اختبارات TypeScript مباشرة؛ لم تُغيّر طبيعة المشروع كله إلى ESM لمعالجة تحذير غير قاتل.
- لا بث حقيقي ولا whitelist/حقوق/مفاتيح/بريد حقوق أو Supabase حقيقي تم تهيئتها. يلزم اختبار قانوني وتقني لمقدميك من النطاق المنشور.
- الحقوق/التشكيلات/بيانات النتائج الناقصة لا تُخمن، ولا يُدّعى تسليم رسالة mailto أو بلاغ فاشل.
- هذه نتائج محلية سابقة لنشر pull request، وليست إثباتًا لنتائج GitHub Actions أو لنشر Vercel فعلي. معاينة Arena جاهزة للفحص؛ اتبع checklist التشغيل قبل الإطلاق.

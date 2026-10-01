# KoraScore — سجل الميزات والتجربة التفاعلية

**نسخة التطبيق:0.1.0 · آخر مراجعة:2026-10-02.** تواريخ السجل للعمل المحلي، لا إثبات نشرVercel. الفرع ثابت للجلسة: `arena/01a0f902-koraaaaaaaaaaaa`. لا merge/main/deploy في هذه الدورة.

## ميزات قائمة — لم نعد بناءها

| الميزة | آخر تاريخ مثبت | الحالة/الحدود |
|---|---|---|
| نتائج/مباشر/مواعيد،بطولات/فرق،ترتيب/هدافون |HEAD2026-10-01|✅ مصادر حقيقية بحدود خططها،لاcoverage شامل مضمون |
| مركز المباراة الأساسي |HEAD2026-10-01|✅ نتيجة/حالة/موعد/details؛قائمةالأحداث طُورت أدناه |
|H2H/أرشيف/Search/NewsHub |HEAD2026-10-01|✅ H2H موجود،feeds اختيارية وcredits،لا أخبارمصطنعة |
|SEO/PWA/timezones/RTL-LTR |HEAD+العمل2026-10-01|✅ محفوظة؛موردOG جديد لاpageفهرسة جديدة |
|مفضلة فرق/بطولات/لاعبين وملفزائر/رئيسيةشخصية |2026-10-01|✅ local-firstمحلي؛لاaccounts/cloud-sync |
|البث الرسمي الاختياري |HEAD2026-10-01|✅ قائم؛catalogالإنتاجفارغ فعلًا،backendDBاختياري عندتهيئته |

[تدقيق التخصيص](docs/PERSONALIZATION-PHASE0-AUDIT.md) · [تسليمه](docs/PERSONALIZATION-PHASE1-DELIVERY.md).

## خريطة الإضافات — الحالة المحدثة

|#|الميزة|المصدر/التعقيد|المرحلة|الحالة/آخر تحديث |
|---|---|---|---|---|
|1|**Match Story**|UnifiedMatchevents،متوسط|Cycle1|✅2026-10-02؛filters/details/RTLkeyboard/touch/finishedhighlights،missingdata صادقة،لاscore منpartialevents |
|2|**Shareable Cards**|البياناتالقائمة+SVG/OG،منخفض–متوسط|Cycle1|✅2026-10-02؛result/live/fixture،preview/SVG/PNG/copy/native/social،بلاclubart غيرمرخص |
|3|Daily Briefing|aggregation قائم،منخفض|Cycle2|⏸ جزءكبير فيالرئيسية/اللوحة؛إكمالالفجوات فقط بعدموافقةالمتابعة |
|4|Match Analysis Center|H2H/form/results/standings،متوسط|Cycle2|⏸ reuseالقائم؛لاprobabilities/tacticalcauses/ratings بلاsource |
|5|Fan Pulse|durableDB/backend وanti-abuse،عالٍ|لاحقًا|⏸ لاعدادvotesمشتركة وهميةمنlocalStorage/cookies/JSON |
|6|Interactive Stats/Tactical Board|statistics/lineups/coordinates،متوسط|Cycle3|⏸ نقصنموذجالبيانات؛squadليسstartingXI،لاheatmapتقديرية |
|7|Low Data Mode|إعدادواستهلاكطلبات،متوسط|Cycle3|⏸ systemfonts/lazy/cache/visiblepollingقائمة؛إعدادالوضعلاحقًا |
|8|Local Coverage موسعة|تقييممصادر/ترخيص،متغير|لاحقًا|⏸ EGYالأصولقائمة؛كأس/درجات/شباب تحتاجfreshness/completeness/rights |

## بوابات التسليم المحلي للدورة1

- التدقيق والجرد ومصفوفةالمصدر كُتبت **قبلالكود**: [Phase0](docs/INTERACTIVE-PHASE0-AUDIT.md).
- القصة اختُبرتقبلالبطاقات:201unit +12browser +type/lint/build ناجحة.
- النهاية: **230/230 Node +68/68 Playwright**،default/livebuild/type/lint/livevalidator ناجحة،npmAudit0knownvulnerabilities،155localSEOassertions ناجحة.
- Lighthousehome mobile محلي **98/96/96/100** قبلوبعد؛LCP2.3→2.5s،TBT60→50ms،CLS0،243→244KiB. عينةواحدة،لاfieldCWV/staging أوتحسن مضمون.
- Coverage **8helpersمستوردة فقط**:100%lines/100%functions/90.08%branches؛ليسالتطبيقكله أوJSX/canvas.
- توثيقprops/env/fonts/cache/security/maintenance: [المكونات](docs/INTERACTIVE-COMPONENTS.md).
- حدودمصادرالتحقق والفحوصوالتأجيل: [تقريرالتسليم](docs/INTERACTIVE-CYCLE1-DELIVERY.md) · [metricsJSON](docs/INTERACTIVE-CYCLE1-METRICS.json).

## قواعد لا تتغير

- لا fixtures/events/stats/ratings/formations/news مصطنعةفيالإنتاج؛testdataفيتطبيقfixtureوعمليةمنفصلتين فقط.
- لا DB/service/subscription/accountschema جديدة؛local-first محفوظ،accounts/sync تنتظرموافقةبنية صريحة.
- النتيجة/الدقيقة مصدرية؛unknownteam≠away؛غيابأهداففيfeed لايعني0أهداف. missingstatisticsمخفية.
- Shared/downloaded image لقطةمؤرخة لاrealtime بعدالإرسال. publiccards/OGبتوقيتUTC،pagetimezone مازالتاختيارية.
- font/ownbrandفقط؛hostallowlist≠ترخيصتوزيعclubimages؛الحقوقالتجاريةلعقدالمزود منفصلة عنالكود.
- APIs/routes/name/logo/theme/SEO/التخصيصالسابقمحفوظة؛العملالحالييتوقفقبلCycle2 والنشر.

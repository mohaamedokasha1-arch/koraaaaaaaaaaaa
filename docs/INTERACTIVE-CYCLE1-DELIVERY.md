# تسليم الدورة الأولى — Match Story + Shareable Cards

**التاريخ المحلي:** 2026-10-02 · **التطبيق:** KoraScore0.1.0 · **الفرع:** `arena/01a0f902-koraaaaaaaaaaaa`.

## الخلاصة

الدورة الأولى فقط من الخريطة الجديدة أُنجزت محليًا: تطوير قصة المباراة الموجودة أولًا، اختبارها، ثم بطاقات المشاركة واختبارها. لم تُنفذ الميزات الست الباقية، ولم تُضف حسابات أو DB/service/subscription. تغييرات التخصيص local-first السابقة محفوظة، والاسم والشعار والهوية والصفحات والمزودون لم يُستبدلوا.

**لا merge أوpush أوdeploy/main.** مساحة العمل تُحفظ في فرع الجلسة؛ ليست هذه وثيقة إصدار إنتاج منشور.

[التدقيق قبل أي كود جديد](INTERACTIVE-PHASE0-AUDIT.md) · [عقود المكونات والصيانة](INTERACTIVE-COMPONENTS.md) · [الأرقام بصيغةJSON](INTERACTIVE-CYCLE1-METRICS.json) · [FEATURES.md](../FEATURES.md).

## 1. ما أُعيد استخدامه وما أُضيف

| قائم ومُحافظ عليه | التطوير الجديد |
|---|---|
| صفحة المباراة والنتيجة والحالة والتاريخ/details | `MatchStory` بدل inline timeline البسيط، لا صفحة أخرى |
| `getMatchMemo` والمزود صاحبID/cache60ث | نفس البيانات، بلا API للقصة أوpoller مكرر |
| AutoRefresh60ث visible/debounced | props حديثة تُحدث القصة والمعاينة؛ لا ساعة لعب مختلقة |
| PageMetadata/canonical/hreflang/SportsEvent/breadcrumb | OG/Twitter PNG مرتبط بالمباراة، مع fallback صادق |
| شعار KoraScore/الألوان/nav/public APIs/H2H | الشعار نفسه في SVG، دون صور/شعارات أندية جديدة |
| المفضلة/profile/privacy/personal home | جميع اختبارات المرحلة السابقة باقية وناجحة |

تصحيحان متعلقان بالدمج: نسبة فريق مجهول في أحداث المباراة لم تعد تُفسّر تلقائيًا كضيف؛ وfreshness أعلى الصفحة يتبع timezone المختار بدلdefault ثابت. كما حُصّن JSON-LD المباراة من إغلاقscript باسم مصدر عدائي، مع بقاءJSON قابلًا للتحليل وSEO سليمًا.

## 2. Match Story

- Timeline عمودي قابل لإعادة الاستخدام، goal/own-goal/penalty، بطاقات وصفراء ثانية/طرد، تبديلات، assist/in/out عند وجودها فقط.
- تفاصيل بالنقر وnative keyboard؛ تبويبات أفقية، RTL/LTR arrows وHome/End، وسحب touch حقيقي مختبر في Chromium.
- تقسيم الدقائق: الأولحتى45،الثاني46–90،بعد90،غيرالمحدد. **period رسمي غير موجود**؛ النص يوضح أن بعد90 قد يكون stoppage أوextra-time. 45+3 قبل46، لا ترتيب بالجمع الخاطئ.
- لا نسبة فريق بلاexactID. لا timestamp→minute أوpartial goal count→score.
- نهاية المباراة تعرض آخر6 أحداث goals/dismissals المرسلة، لا احتمالات أو «من سيطر» أو أسباب الفوز/تقييم لاعب. لاhighlights فيfeed لا يعني أنه لم تحدث أهداف.
- المصدر الفارغ/upcoming له إفصاح واضح بلاsampleevents. إحصاءات possession/shots/corners/ratings/lineups غائبة فلا نعرض أقسامًا لها.
-300 سجل حد آمن،40 أولًا ثمmore؛ omissions/non-renderable records معلنة.

**بوابة الترتيب أُجريت فعلًا قبل كود البطاقات:**201/201 unit،12/12 browser قصة،typecheck/lint/build ناجحة. لم يُنفذ العنصران بالتوازي دون اختبار الأول.

## 3. Shareable Cards

- result/live/fixture من **status الفعلي**، بما فيهhalftime/postponed/cancelled؛ fixture لا يعرض0–0 كأنه نتيجة مباراة ملعوبة. الموعد عندإلغاء/تأجيل هو سجل المصدر فقط، وليس وعدًا بموعد جديد.
- النتيجة والدقيقة منprops المصدر، null→«—» لا0. HT/pens فقط إذا وصل الرقمان؛ **لاstat-card وهمية** لبقية الأرقام غير المتاحة.
- معاينة SVG، تنزيلSVG وPNG1200×630، copy للرابط من **origin المتصفح الحقيقي**، native link/file share إذا مدعوم، وروابطFacebook/X آمنة دون SDK/tracker.
- مشاركةPNG خطوتان عنداللزوم: تجهيز الملف أولًا، ثم share منclick جديد للمحافظة علىactivation فيمتصفحاتالموبايل. تحديث المصدر يُبطل ملفPNG القديم الجاهز ويجدد المعاينة.
- Clipboard/canvas/native failures وAbortError لها رسائل صريحة وSVG/manual-copy بدائل. «تم التسليم لنافذة المشاركة» ليس إثبات نشر اجتماعي.
- renderer مؤجل حتى فتحcard، exporter حتىالطلب. لاsourceAPI خاص بالمعاينة أوتنزيلالملفات، ولاfonts/images طرف ثالث.
- وقت الصورة هو **آخر جلب لبيانات اللقطة**،UTC، لا تاريخ مُلفق حديثًا بمجرد الضغط. جميع مواعيدcardUTC؛ الصفحة نفسها ما زالت تتبعcookie timezone.
- الملف المنزّل أو المشترك صورة ثابتة. التخزين المؤقت للمعاينة لدى المنصات خارج السيطرة، ولا نقول إنها ستتحدث بعد الإرسال.

### العربية والترخيص — تحقق عملي لا افتراض

- SVG/Canvas استعملا shaping/bidi الجهاز. مراجعة PNG الفعلية كشفت أن دمج label/date/HTscore في جملةRTL يقلب أجزاءها؛ فُصلت إلىعناصر، وأضيف regression لتواريخISO والأرقام المركبة LTR معhome يمينًاAR.
- next/og جُرّب فعليًا: Noto Sans Arabic الحالي فشل فيlookupType5/substFormat3. لم نشحنه أو نخفِ فشله؛ استُخدم Tajawal400 Arabic/Latin WOFF المرخصOFL منFontsource5.3.0.
- Satori glyph-shaping وحده لا يكفي لترتيب الكلمات؛ explicitAR wordruns وLatin runs، وفصلlabels عنdates، راجعتها صورPNG فعلية.
- الخطان25,476 بايت وOFL4,314 بايت، ملفاتمحلية server-only؛ client يظلsystem-font.398codepoints منcmap فعلية؛ خارجهاmetadata يستخدمOG الموقعالافتراضي معإفصاح، ولاremote fontservice أو ترجمة اسم مزعومة.
- شعاراتالأندية/الصور **لا تدخلCardModel/export**؛ أسماء وmonograms فقط، وشعارKoraScore الأصلي لا تصميم بديل. hostallowlist ليس ترخيصتوزيع. شروط عرض/إعادةاستخدام بياناتالمزود وخطةالمشغّل تظل شرطالتشغيل وليست حقوقًا تجارية نضمنها.

## 4. النتائج الفعلية النهائية

| البوابة | قبلالدورة | بعدالدورة |
|---|---:|---:|
| TypeScript | ✅ | ✅exit0 |
| ESLint | ✅ | ✅exit0 |
| Node unit/integration |190/190|**230/230**،0failure/skip |
| Playwright |38/38|**68/68**،≈98ث،0failure/skip |
| build default/live-enabled |✅/✅|✅/✅،exit0 |
| live catalog validator |✅emptyrealcatalog|✅0matches/0sources/0channels فعلية |
| npm dependency audit |0knownvulnerabilities|**0** بجميع الدرجات |
| SEO المحلي الكامل |baseline السابق مثبت |**155 assertion pass /0warn /0fail**،ليس155صفحة |
| `git diff --check` |—|✅0 |

40 اختباراتNode جديدة:11 للقصة +20بطاقات/model/SVG/fonts +9HTTPimage.30browser جديدة:12قصة +18مشاركة/OG/دمج/أمان. **كل190+38 السابقة ما زالت ناجحة**.

Coverage المنفذة بواسطةNode22 experimental: **100%lines/100%functions/90.08%branches في8helpers خالصة مستوردة فقط** (`copy/model/brand/font-coverage/image-http/svg`). هذا **ليس100%تغطية التطبيق** ولاcoverageReact/JSX/Canvas/server-renderer أو كلroutes. E2E تكمل بعض تلك المسارات، ولا تتحول إلىنسبةتغطيةكود عامة.

اختباراتالموبايل:320×568،667×375 landscape،1280×720،AR/EN،بلاoverflow أوpageerror فيالسيناريوهات. تُعاد الصفحةالإنتاجية نفسها/metadata داخل **testprocess مع cache مصنوع ومعزول**، وليسfake-mode فيالإنتاج. slow3G-like **للتحميلالمؤجل بعد تحميلالصفحة**:400ms/50,000B/s/CPU4×،وPNGexportنجح؛ لا ندّعي قياسinitialwholepage على3Gميداني.

تحذيراتbaseline القائمة: Edge runtime deprecated/static-generation warning في الوحدة القديمة، وMODULE_TYPELESS من Node حين تشغيل بعض TS tests/scripts. تطبيق fixture المعزول يسجّل كذلك metadataBase fallback إلى localhost:3101 لأنه لا يستعمل layout الإنتاج الكامل؛ canonical/OG الإنتاجية تُختبر منفصلة. لا تحذير fatal جديد؛ لم نغيّر module type لمجرد إسكاتها.

## 5. الأداء: قبل/بعد بحدود واضحة

قياسLighthouse محلي منفرد لكلمرحلة، `/ar`،productionbuild،Chromium/settings نفسها،بدونE2E بالتزامن. مفاتيحFD/AF وnewsfeeds غيرمهيأة؛ ESPN مُعطّل فيQA المقارنة وتمت تجربةشبكته الفعليةمنفصلًا وفشلت. هذه ليستstaging/Vercel ولاfieldCWV.

| metric | قبل | بعد |
|---|---:|---:|
| Performance |98|98|
| Accessibility |96|96|
| Best Practices |96|96|
| SEO |100|100|
| FCP |0.9s|0.9s|
| LCP |2.3s|2.5s|
| TBT |60ms|50ms|
| CLS |0|0|
| totaltransfer |243KiB|244KiB|
| requests /JSrequests |31/11|31/11|
| JStransferred |214,199B|214,911B (+712B) |

لم ننسب فرقTBT إلىتحسن مؤكد أو نخفِ زيادةLCP؛ العينةمفردة والمصدرمقيد. نقطتاaccessibility/best-practicesمتبقيتان بسببcontrast موروث وnetwork failures لصوربطولاتخارجية، موجودتانقبلالدورة. لا claim «أفضل من كلالمواقع» أوranking/FPS/error-rate/CWV عالمي.

تكلفةالإضافة المرصودة:
- SVG snapshotمثالاختبار: **6,629B**،standalone،دونexternalresources.
- renderer/SVG panelchunk **26,591B raw**؛ exporter **1,154B raw**،مؤجلان. rawfilesize ليستroute-transferredJS؛ لا ندّعي أننا قسناJSلمباراةحقيقيةمتاحة.
- OG Arabic PNG الفعلي فيآخرfixture: **76,972B**،1200×630. CanvasPNG أكبر ومتغير حسبالمتصفح (≈584KiB هنا)،وتنزيلهاختياري؛SVG البديلخفيف،ولا ينتقلPNG عندتصفحالعامة.
- القصة/المعاينة/export لا تضيفAPIdatarequests؛OGresource وحدهgetMatchcached للمباراةحينيُطلب. ليستهناكبروتوكولاتstream أوchartlibs أواشتراكجديد.
- outputtracing رصدWOFF×2/OFL فعليًا:289files،53,722,905B غيرمضغوطة بمافيهاNext/framework/providers؛ ليسحجمfont أوحجمdownloadbrowser ولادليلpackageVercelمنشور. Nodebuildنجح؛deploymentلم يُجرّب.

## 6. الأمن وSEO وserver compatibility

- Public technicalGET `/{locale}/matches/{id}/share-image`؛لاsitemappage جديدة،وrobotsيسمحللصورةالاجتماعية. X-Robotsnoindex/nofollow لكلmethods،nosniff،CSP،genericerror.
- IDs/locale/query-validation قبل IO؛لاURLعشوائي،template/scoreparameter أوcrestproxy. boundedimagecache32/inflight8/output512k. limiter60/min **per-instance** بلاcrawler-UA exemption؛ ليسanti-fraud/durableglobalWAF.
- Sourcefail/stale موضحة؛stale/errorsno-store؛PNGcache30ثlive/fixture و300ثfinished. SW لا يخزنscoreimage بهذاالمسار.
- SVG XMLescape/controlsurrogateguards؛لاscripts/foreignObject/externalassets. MatchJSON-LD escaped`<`،اختُبر فعليًا أناسم`</script><script>` فيfixture لا ينفذوأنSportsEventيبقىJSONصالحًا.
- originalcanonical/hreflang/JSON-LD/routes والحساباتالخاصةnoindex محفوظة؛specificOG/Twittermetadata اختُبرت علىPageالإنتاجية المُعادةفيfixture. `NEXT_PUBLIC_SITE_URL` يجبضبطه لدومينالإنتاجقبلنشر؛BrowsercopyلايستعملfallbacklocalhostمنENV.
- No filesystemwrites runtime؛readstaticfonts only. package/lock **لم يتغيرا**،Lighthouse/Fontsourcepack أُحضرتللتدقيقمؤقتًا لاdependenciesللتطبيق.

**تحققHTTP فعلي علىMainbuild،غيرmock:**

| request | status | النتيجة |
|---|---:|---|
| invalidID image |404|JSONgeneric،no-store،noindex/nosniff |
| querysource/score image |400|بلاupstream،no-store |
| validFDID بلاconfiguredprovider |503|`image_unavailable`،no-store،لاPNGمباراةوهمية |
| POSTimage |405|GET-only،noindex/nosniff منconfig |

**200PNG وcorrectdimensions/headers** فُحصت علىNode/imagehandlerالإنتاجيين فيعمليةfixture،ببياناتsyntheticواضحة. ليس هذا إثباتcoverageلدفعAPIأو لمباراةحقيقيةحاليًا.

## 7. ما لم يتحقق خارجيًا

- لاrealVercelstaging/deploy،productiondomain/SearchConsole/fieldCWV،ولاOSphysicaliOS/Safari أونشرFacebook/X فعلي.
- FD/AFkeys غيرمهيأة،RSS/DBbackend غيرمهيأ؛ActualESPNrequest فشلشبكيًا فيsandbox. لا مصدرمباراةحقيقيةحديثةيوفر200يمكنعرضها كبرهانهنا. لا تمريربياناتtestإلىsrc/app/public لتغطيةذلك.
- fixtures تعزلmissing/full/stale/malformed cases وتختبرwiring/PNG/props/contracts،لاfeedSLA. تحديثpreview يختبرprops؛الحدالأقصى للفوريةيبقىcache/pollالمصدر.
- الحقوقالتجارية/إعادةتوزيعبياناتخطةالمشغّل،حقوقالأنديةوالصور،حصصVercelوالخدمات يجبتأكيدهاقبلإطلاقعامموسع. نضمنفقطأننا لم نضفاشتراكًا أوservice/configsecret جديدًا فيالكود.
- لا نسبةerror-rate/FPS/globalcodecoverage مفبركة؛نتائجالمتصفح بلاruntimeerror فيالسيناريوهاتالمحددةفقط.

## 8. المتابعة المؤجلة، لا التنفيذ التلقائي

| المرحلة | ماينتظر |
|---|---|
|Cycle2|إكمالفجواتDailyBriefing/MatchAnalysis؛استعمالالرئيسية/اللوحة/H2H/form/standingsالموجودة |
|Cycle3|statistics/lineups/coordinates منمصدرحقيقي قبلstats/tactics/heatmaps/ratings؛LowDataModeبعدها |
|FanPulse|durablebackend/schema/RLS/anti-abuse وموافقةبنية؛لاglobalpollcountsمنlocalStorage/cookies/JSON |
|LocalCoverage|freshness/completeness/commercialrights لمصر/كأس/درجات/شباب؛لاemptypages أوfakefixtures |
|Accounts/sync|قرارexplicitللبنيةوالخصوصية/email/provider؛local-firstيبقىالخيارالقائم |

توقفنا عندنهايةالدورة1. لا schemaUsers/Votes،لا Firebase/Supabase جديد،لا ادعاءقاعدةبيانات«مجانيةبلاDB»،ولا مقامرة/مال/جوائز.

## الملفات الأساسية والتشغيل

- Featurecode: `src/features/match-story/`،`src/features/share-cards/`.
- دمج: matchpage وshare-imageroute،header تقني محددفيnextconfig؛لا تغييرproviders/UnifiedMatch/publicdata.
- tests: `match-story.test.mjs`،`share-cards.test.mjs`،`share-image-http.test.mjs`،`e2e/match-story.spec.ts`،`e2e/share-cards.spec.ts`،fixtureinteractiveالمعزولة.
- docs: audit/components/metrics/delivery وFEATURES/README.

طرقإعادةالفحص وعقودprops/env/source/fontmaintenance مفصلةفي [دليلالمكونات](INTERACTIVE-COMPONENTS.md). سجلاتالتنفيذكانت `/tmp/kora-interactive-{baseline,final}-*`؛الأرقاماللازمةمُثبتةهناوفيJSONبدلإيداعlogs/assetsكبيرًافيGit.

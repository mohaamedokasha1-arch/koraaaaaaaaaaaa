# الدورة الأولى — بنية المكونات وعقود الصيانة

2026-10-02 · KoraScore0.1.0. [الفحص قبل الكود](INTERACTIVE-PHASE0-AUDIT.md) · [سجل الميزات](../FEATURES.md).

## لا مسار بيانات جديد للقصة

```text
/{locale}/matches/{id}
  getMatchMemo → provider-owned getMatch → cache60s / stale fallback
    ├ generateMetadata (canonical/hreflang/SportsEvent/OG)
    ├ score/status/freshness/details الحالية + AutoRefresh60s
    ├ MatchStory → buildStory → EventTimeline
    └ buildShareCard → ShareCardGate
                         └ intent → ShareCardPanel → SVG preview/copy/social
                                     └ export intent → export-client → SVG/Canvas PNG

/{locale}/matches/{id}/share-image (public technical GET, Node)
  serveShareImage → validate → limiter → getMatchMemo → renderShareImage
    → licensed local fonts → ShareImage → next/og → PNG1200×630
```

- لا polling/fetch/storage خاص بـtimeline أوcard preview؛ مصدرهما هو props الصفحة القائمة. لا حساب النتيجة من أحداث ناقصة.
- AutoRefresh القائم يبقى60ث للحي/الاستراحة/قرب البداية، visible-only/debounced؛ quota وTTL للمزود يظلان الحاكمين. لم نضف SSE/WebSocket/Push أو نغيّر مزود البيانات.
- توقيت الصفحة بحسب `KORA_TZ`، بما فيه freshness. **مواعيد البطاقة وOG ثابتةUTC** لعدم تسريب تفضيلات/كوكيز في موارد عامة أو مضاعفة فهرسة URLs.
- كل ملف/صورة منصة snapshot؛ تغيير props يجدد المعاينة فقط ولا يعدّل ملفًا نُزل/أُرسل. platform OG cache خارج سيطرتنا.

## Match Story

### الملفات والعقود

| الملف/المكون | Props/الدور |
|---|---|
| `src/features/match-story/components/MatchStory.tsx` | `{match: UnifiedMatch, locale: 'ar'|'en'}`؛ shell خفيف، empty/upcoming، ملخص highlights للنهاية من أحداث حقيقية فقط |
| `EventTimeline.tsx` | `{events: readonly StoryEvent[], locale, homeName, awayName}`؛ native details، ARIA tablist/tabpanel، Home/End/arrows/RTL swipes،40 حدثًا ثم more |
| `lib/model.ts` | `buildStory/filterStory/eventMinute/eventSegment/adjacentSegment/storyText/isHighlight`؛ normalization وعرض، لا شبكة أو storage |
| `lib/copy.ts` | جميع التسميات AR/EN، ومنها second-yellow dismissal وunknown minute/team |

`StoryEvent = MatchEvent + {key,side,segment}`. `key` مفتاح React للعرض، **ليس معرف لاعب/حدث مزود مصطنعًا**. `side` لا يصبحaway لمجرد أنه ليسhome؛ يجب أن يطابق ID الضيف بدقة، وإلاunknown.

حد أقصى300 سجل،40 ظاهرًا أولًا. المدخلات غير الصالحة/المتجاوزة لها تنبيه. النصوص160 codepoints، control/bidi overrides تُحذف، ومحتوى أسماء المصادر يُرسم عبر React escape.

التقسيم `all/first/second/later/unknown` **بحسب الدقيقة فقط**: حتى45،46–90،بعد90،بلاminute. 45+3 يبقى قبل46، و90+4 داخلminute90. لا نسميlater «وقتًا إضافيًا مؤكدًا»، لأن النموذج لا يحملperiod. المعلومة موضحة في UI. التفاصيل بلاminute لا تتحول إلىminute0 أوkickoff تلقائي.

ملخص النهاية: آخر6 goals/own-goals/penalty-goals/red/yellow-red المسجلة، مع إشارة إلى باقي القصة. Yellow/sub ليست rating أو أبرز لاعب. عدم وجود goals فيfeed لا يعني0 أهداف؛ النتيجة الرسمية أعلى الصفحة مستقلة.

## Shareable Cards

### الملفات والعقود

| الملف/المكون | Props/الدور |
|---|---|
| `lib/model.ts` | `buildShareCard(DataResult<UnifiedMatch>, locale): ShareCardModel|null`؛ projection صغير عام، actual status/score/minute/source/fetchedAt، UTC، formatting/link helpers |
| `lib/font-coverage.ts` |398 codepoints فعلية منcmap الخطين؛ glyph guard يمنع remote font recovery |
| `ShareCardGate.tsx` | `{model: ShareCardModel}`؛ الزر فقط أولًا، ARIA state، dynamic SSR-off panel بعد النقر |
| `ShareCardPanel.tsx` | `{model}`؛ SVGpreview، SVG/PNG/copy/native/social، حالات فشل/إلغاء صريحة، لا sourceAPI خاص |
| `lib/svg.ts` | `buildCardSvg(model, link?)`؛ standalone SVG1200×630؛ XML escape لكل النصوص، لا script/foreignObject/externalimages/fonts |
| `lib/brand.ts` | النسخة الدقيقة من `src/app/icon.svg` القائمة؛ اختبار equality يمنع تبديل الهوية |
| `lib/export-client.ts` | lazy بعدexport؛ Blob/download، Canvas PNG، decode/toBlob timeouts10ث، Object URL cleanup30ث |
| `ShareImage.tsx` | flex/absolute next/og markup فقط؛ glyph shaping وRTL word runs، Latin runs سليمة، الأزمنة/labels منفصلة |
| `lib/server.tsx` | Node/server-only fonts/image rendering؛ لا واردات client من هذا الملف |
| `lib/image-http.ts` | public request contract مع dependency injection **للاختبارات فقط**، validation/caching/errors |
| `app/[locale]/matches/[id]/share-image/route.ts` | GET الحقيقي مربوط دائمًا بالمزود القائم، لا test flag أو user-defined score/template |

### دقة الأنواع والعرض

- `finished → result`؛ `live/halftime → live`؛ `scheduled/postponed/cancelled → fixture` مع **status الحقيقي**. لا اختيار «نهائية» على مباراة حية.
- fixture لا يعرضadapter0–0 أوHT/pens وكأن المباراة لعبت. الرقم0 الحقيقي للمباراة الملعوبة يُحفظ؛ null لا يتحول إلى0.
- half-time/penalties إذا كان **الرقمان معًا** متاحين. لا possession/shots/corners/statistics card/ratings لعدم وجودها فيالنموذج.
- source منenvelope إذا معلوم، ومن `match.provider` عندcache؛ وقت البيانات هو `DataResult.fetchedAt` لا ساعة تصنيع الصورة. UI يسميه «آخر جلب للبيانات».
- لا crest/emblem/photo/events/favorites/account IDs داخلCardModel. monograms مشتقة من النص، لا شعار نادٍ رسمي.
- client link من `window.location.origin` ومسارالمباراة الحقيقي/اللغة فقط؛ لاlocalhost ثابت ولا preferences/querytracking. metadata origin من `NEXT_PUBLIC_SITE_URL` كما هو في النظام القائم، فيجب ضبطه للإنتاج.

### العربية والحقوق

- SVG يستعمل shaping/bidi الأصلية للجهاز. label/date/secondary-score عناصر منفصلة؛ تواريخ ISO والأرقام المركبة LTR حتى داخلRTL. لا تقلب ترتيب home/away:home يمينًاAR ويسارًاEN.
- OG يستعمل Tajawal400 Arabic/Latin WOFF مرخصًاOFL،25,476 بايت، server-only. المصدر/النسخة/checksums/الترخيص في [assets README](../src/features/share-cards/assets/README.md). لا Google Fonts fetch.
- Satori لا يرتب كلمات العربية كما يفعل المتصفح؛ `ogTextRuns` يضع كلماتAR منفردةRTL ويحتفظ بعبارةLatin كـrun. glyphs خارجcmap تعني generic OG الموجود، مع إفصاح فيpanel؛ لا أسماء مترجمة/محذوفة اختراعًا أو remotefont طلب.
- الخط فيbitmap لا يحتاج نقلOFL للصورة، لكن **حافظ علىOFL مع ملفاتالخط نفسها**. SVG لا يضمfontbinary أصلاً.
- Brand equality test عندتعديل `src/app/icon.svg` يتطلب تجديد `brand.ts`. تغييرالخطوط يتطلبcmap regeneration،checksums،اختبارPNGعربي بصري وtrace build؛ توسيعCSS allowlist ليس دليلترخيص أو glyphsupport.
- حقوق إعادةاستخدام بياناتالمزود وفق عقد/خطة المشغّل تبقى مسؤوليةالتشغيل؛ لا نقول إنhostallowlisting أو غيابAPIkey يضمن commercial rights.

### OG resource/security/cache

- مسار عام مرتبط بالمباراة، ليس HTMLpage جديدًا؛ لا sitemap entry. `robots.txt` يسمح بتحميله للصورة الاجتماعية، مع `X-Robots-Tag:noindex,nofollow` لكلmethods عبرconfig والhandler.
- GET فقط؛ localear/en، IDnumericfd/af/tsdb أو ESPN boundedslug+numericID، length100. ممنوع arbitraryurl/path/source/free-text/query. rejectedinput لا يصلللمزود.
- `no-store` لكل400/404/429/503 ولبياناتstale؛ nosniff وgenericerrors وCSP صارم. provider/render failure503 وRetry-After30؛ عدمالمباراة404. لا rawerror/providerkey/IP/cookie logs.
- rate limit60/min/client **per-instance**، بلاcrawler user-agent bypass. ليس anti-fraud durable أوDDoS/WAF عالميًا.
- PNGcache32 entries،8 rendersinflight،512,000 bytes/image،coalescing؛ TTL30ث live/fixture،300ث finished. HTTPlive `s-maxage=30,max-age=0`؛ finished `s-maxage=300,max-age=60`. لا cachedstaleimages. memorycache ليس DB أو realtime sharedstore.
- Node filesystem **قراءةأصول ثابتة فقط**؛ لا writes أو remoteassetproxy. build tracing يجب أنيشملWOFF×2/OFL. لا services/subscriptions جديدة، لكنfunctionusage تبقى وفقميزانيةVercel والمزود.
- SW لا يخزنresource: مساره بلا امتداد، وليس `_next/static/image` ولا navigation؛ لا نعيد yesterday score منSW.
- Hardening متعلق بالدمج: MatchJSON-LD يستبدل`<` بـ`\\u003c`، فيظلJSONصالحًا دونإغلاقscript بعناوينطرفثالث. الاختبار يستخدماسمًاعدائيًا فيعمليةfixtureفقط.

## البيئة/التشغيل والاختبارات

**لا متغيربيئةجديد، لا schema أوsubscription.** استخدم أسماءenvالقائمة في [.env.example](../.env.example) و[الفحص](INTERACTIVE-PHASE0-AUDIT.md). لا تطبع القيم. `NEXT_PUBLIC_SITE_URL` للدومين العام،providerkeys server-only؛ Cardtimezones مستقلةUTC.

```bash
npm run typecheck
npm run lint
npm test
npm run live:validate
npm run build
NEXT_PUBLIC_LIVE_ENABLED=true npm run build
npm run test:e2e
node scripts/seo-check.mjs http://localhost:3000 --local
npm audit --json
# Node22 — coverage للhelpers المستوردة، لا التطبيق كله أو JSX/Canvas
node --test --experimental-test-coverage \
  '--test-coverage-include=src/features/match-story/lib/*.ts' \
  '--test-coverage-include=src/features/share-cards/lib/*.ts' tests/*.test.mjs
```

E2E تستخدمmainproduction3000 و**fixtureApp مستقلاً3101**. `tests/e2e/fixture-app/app/interactive` يستعملsynthetics وtest-only cache داخل **عملية الاختبار فقط**، ويعيد استخداممكونات/Page/metadata الإنتاجية. production لا يستوردfixtures ولا fake-source flags. NativeOS share tests تحاكيAPIhandoff؛ ليستدليلSafari/iPhone أو نشرFacebookفعلي.

## مؤجل عمدًا

Cycle2: فجواتDailyBriefing/Analysis علىH2H/form/standings الموجودة. Cycle3: stats/lineups/coordinates وموافقةcoverageقبلتشكيلات/heatmap، ثمLowDataMode. لاحقًا: FanPulse معdurablebackend وanti-abuse حقيقي (ليسlocalStorage counts)،source/licensingevaluation لتغطية مصر الأوسع. Accounts/cloud-sync تحتاج قراربنية صريح؛ local-first قائم ومحفوظ.

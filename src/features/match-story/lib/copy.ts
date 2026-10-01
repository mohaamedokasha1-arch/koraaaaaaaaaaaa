import type { Locale } from '../../../i18n/locales';

const ar = {
  title: 'عِش المباراة', subtitle: 'قصة من أحداث المصدر، لا تحليل تقديري.',
  available: 'قد لا تشمل التغذية كل أحداث المباراة. النتيجة المعروضة أعلاه من المصدر وليست مجموع أهداف هذه القائمة.',
  scheduled: 'تبدأ القصة عند وصول أحداث موثقة من المصدر. لا أحداث تجريبية أو توقعات هنا.',
  empty: 'لا يوفّر المصدر أحداثًا لهذه المباراة حاليًا.',
  segmentLabel: 'نطاق دقائق الأحداث', segmentNote: 'التقسيم بحسب الدقيقة المتاحة، لا فترة رسمية من المصدر. وقت بدل الضائع ضمن الدقيقة الأساسية؛ ما بعد90 قد يكون بدلًا ضائعًا أو وقتًا إضافيًا.',
  segments: { all: 'الكل', first: 'الأول · حتى45′', second: 'الثاني · 46–90′', later: 'بعد90′', unknown: 'دقيقة غير محددة' },
  noFiltered: 'لا أحداث مسجّلة في هذا النطاق.', minuteUnknown: 'الدقيقة غير متاحة', teamUnknown: 'الفريق غير محدد من المصدر',
  labels: { goal: 'هدف', own_goal: 'هدف عكسي', penalty_goal: 'هدف من ركلة جزاء', yellow: 'بطاقة صفراء', red: 'بطاقة حمراء', yellow_red: 'طرد بعد إنذار ثانٍ', sub: 'تبديل' },
  player: 'اللاعب', assist: 'صناعة الهدف', playerIn: 'دخل', playerOut: 'خرج', team: 'الفريق', noDetails: 'لم يرسل المصدر تفاصيل إضافية لهذا الحدث.',
  details: 'تفاصيل الحدث', more: 'عرض أحداث أكثر', shown: 'أحداث معروضة', omitted: 'بعض سجلات المصدر غير قابلة للعرض أو تتجاوز الحد الآمن.',
  summary: 'أبرز الأحداث المسجّلة بعد النهاية', summaryNote: 'أهداف وحالات طرد أرسلها المصدر فقط؛ قد تكون القائمة ناقصة، ولا تفسّر أسباب النتيجة.',
  noHighlights: 'لم تصل أحداث أهداف أو طرد في التغذية المتاحة؛ هذا لا يعني أنها لم تحدث.',
  allHighlights: 'تفاصيل جميع الأحداث في القصة أدناه.',
};
const en: typeof ar = {
  title: 'Match story', subtitle: 'Source-recorded events, not speculative analysis.',
  available: 'The feed may not include every event. The score above comes from the provider, not a goal count from this list.',
  scheduled: 'The story starts when verified events arrive from the source. No sample events or predictions.',
  empty: 'The source is not providing events for this match right now.',
  segmentLabel: 'Event minute range', segmentNote: 'Grouped by available minutes, not an official period. Stoppage time stays with the base minute; after90 may be stoppage or extra time.',
  segments: { all: 'All', first: 'First · up to45′', second: 'Second · 46–90′', later: 'After90′', unknown: 'Minute unknown' },
  noFiltered: 'No recorded events in this range.', minuteUnknown: 'Minute unavailable', teamUnknown: 'Team not identified by the source',
  labels: { goal: 'Goal', own_goal: 'Own goal', penalty_goal: 'Penalty goal', yellow: 'Yellow card', red: 'Red card', yellow_red: 'Second-yellow dismissal', sub: 'Substitution' },
  player: 'Player', assist: 'Assist', playerIn: 'On', playerOut: 'Off', team: 'Team', noDetails: 'The source supplied no additional details for this event.',
  details: 'Event details', more: 'Show more events', shown: 'Events shown', omitted: 'Some source records cannot be displayed or exceed the safe limit.',
  summary: 'Recorded highlights after full time', summaryNote: 'Only goals and dismissals supplied by the source. Coverage may be incomplete; this does not explain the result.',
  noHighlights: 'No goal or dismissal events arrived in the available feed. That does not mean none occurred.',
  allHighlights: 'All available event details are in the story below.',
};
export function storyCopy(locale: Locale) { return locale === 'ar' ? ar : en; }

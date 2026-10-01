import type { Locale } from '../../../i18n/locales';

const ar = {
  open: 'شارك بطاقة المباراة', close: 'إغلاق بطاقة المشاركة', title: 'بطاقة المباراة', preview: 'معاينة لقطة المشاركة',
  description: 'البيانات الحالية فقط، بأسماء واختصارات نصية دون صور أو شعارات أندية. كل مواعيد البطاقة بتوقيتUTC.',
  snapshot: 'هذه صورة ثابتة مؤرخة. تتجدد المعاينة مع تحديث بيانات الصفحة؛ الملفات المرسلة وصور المنصات لا تتحدث تلقائيًا.',
  ogFallback: 'بعض الحروف خارج خط الرسم. صورة الرابط تستخدم شعار الموقع الافتراضي؛ معاينة الملفات وتنزيلها يستخدمان خطوط جهازك.',
  loading: 'جارٍ فتح أدوات المشاركة…', downloadSvg: 'تنزيل SVG', downloadPng: 'تنزيل PNG', copy: 'نسخ رابط المباراة',
  shareLink: 'مشاركة الرابط', shareImage: 'مشاركة الصورة', prepareImage: 'تجهيز صورة للمشاركة', imageReady: 'الصورة جاهزة. اضغط مشاركة الصورة لفتح نافذة جهازك.', facebook: 'Facebook', x: 'X',
  copied: 'تم نسخ رابط المباراة.', copyFailed: 'تعذّر النسخ تلقائيًا. يمكنك تحديد الرابط أدناه ونسخه.',
  downloaded: 'تم تجهيز ملف التنزيل.', downloadFailed: 'تعذّر تجهيز الصورة. جرّبSVG أو انسخ الرابط.',
  shared: 'تم تسليم المحتوى لنافذة المشاركة في جهازك.', cancelled: 'أُلغيت المشاركة؛ لم يتم إرسال شيء من الموقع.',
  shareFailed: 'المشاركة غير متاحة أو تعذّرت. استخدم التنزيل أو نسخ الرابط.', noLink: 'تعذّر إنشاء رابط آمن لهذه المباراة.',
  busy: 'جارٍ تجهيز الصورة…', stale: 'بيانات مخزنة — قد لا تعكس آخر تحديث', source: 'المصدر', updated: 'آخر جلب للبيانات',
  home: 'صاحب الأرض', away: 'الضيف', kickoff: 'موعد المباراة', halfTime: 'الشوط الأول', penalties: 'ركلات الترجيح', unknown: 'غير متاح',
  variants: { result: 'نتيجة المباراة', live: 'المباراة الآن', fixture: 'موعد المباراة' },
  statuses: { live: 'مباشر', halftime: 'استراحة', finished: 'انتهت', scheduled: 'قادمة', postponed: 'مؤجلة', cancelled: 'ملغاة' },
};
const en: typeof ar = {
  open: 'Share a match card', close: 'Close share card', title: 'Match card', preview: 'Share snapshot preview',
  description: 'Current source data only, with names and text monograms instead of club images/logos. All card times are UTC.',
  snapshot: 'This is a dated, static snapshot. The preview follows page data updates; sent files and social previews do not update automatically.',
  ogFallback: 'Some characters are outside the OG font. The link uses the default site image; file preview/download uses your device’s fonts.',
  loading: 'Opening share tools…', downloadSvg: 'Download SVG', downloadPng: 'Download PNG', copy: 'Copy match link',
  shareLink: 'Share link', shareImage: 'Share image', prepareImage: 'Prepare image to share', imageReady: 'Image ready. Press Share image to open your device’s share sheet.', facebook: 'Facebook', x: 'X',
  copied: 'Match link copied.', copyFailed: 'Automatic copying failed. Select and copy the link below.',
  downloaded: 'Download file prepared.', downloadFailed: 'Could not prepare the image. Try SVG or copy the link.',
  shared: 'Content handed to your device’s share sheet.', cancelled: 'Sharing cancelled; the site sent nothing.',
  shareFailed: 'Sharing is unavailable or failed. Use download or copy link.', noLink: 'A safe match link could not be created.',
  busy: 'Preparing image…', stale: 'Cached data — may not reflect the latest update', source: 'Source', updated: 'Data retrieved',
  home: 'Home', away: 'Away', kickoff: 'Kickoff', halfTime: 'Half time', penalties: 'Penalties', unknown: 'Unavailable',
  variants: { result: 'Match result', live: 'Match now', fixture: 'Match fixture' },
  statuses: { live: 'Live', halftime: 'Half time', finished: 'Full time', scheduled: 'Upcoming', postponed: 'Postponed', cancelled: 'Cancelled' },
};
export function cardCopy(locale: Locale) { return locale === 'ar' ? ar : en; }

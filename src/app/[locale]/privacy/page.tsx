import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { getPersonalCopy } from '@/features/personalization/lib/copy';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getPersonalCopy(locale);
  return pageMetadata({ locale, path: '/privacy', title: t.privacyLink, description: t.privacyIntro, indexable: false });
}
export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getPersonalCopy(locale);
  const sections = locale === 'ar' ? [
    ['ما الذي نحفظه؟', 'التخصيص اختياري. نحفظ في localStorage تحت المفتاح korascore:preferences:v1 مراجع الفرق والبطولات واللاعبين الذين تختارهم، وبيانات عرض عامة من كتالوج كرة القدم، وإعداد إظهار اللوحة. الحد الأقصى ٦٠ اهتمامًا. هذا ليس حساب مستخدم؛ لا نطلب اسمك أو بريدك أو صورتك أو كلمة مرور.'],
    ['اللغة والتوقيت', 'ملفا NEXT_LOCALE وKORA_TZ يحفظان اختيارات اللغة والتوقيت لمدة تصل إلى سنة. هذه تفضيلات عرض أساسية وليست معرّفات تتبع. المسح داخل مساحتك يزيل اهتماماتك وإعداد التخصيص فقط؛ يمكنك إزالة ملفات اللغة والتوقيت من إعدادات متصفحك.'],
    ['متى تصل الاهتمامات إلى الخادم؟', 'فقط عند فتح الرئيسية مع تفعيل اللوحة: تُرسل مراجع الفرق والبطولات في جسم طلب إلى الموقع لفلترة البيانات العامة. لا نضعها في رابط الصفحة، ولا نسجلها في سجلات التطبيق، ولا نخزن ملف تفضيلات أو هوية مستخدم في قاعدة بيانات. يبقى الرد الشخصي private/no-store ولا يخزنه عامل الخدمة.'],
    ['حدود التخزين والمتابعة', 'تفضيلات هذا المتصفح لا تتزامن مع أجهزة أخرى. قد تُمسح عند تنظيف المتصفح؛ في الوضع الخاص أو عند امتلاء التخزين قد تعمل للزيارة فقط، وتظهر رسالة بذلك. بيانات اللاعب تُعرض فقط من مصادر متاحة، وقد تتغير صفحة التشكيلة أو الهدافين بمرور الوقت. المتابعة لا تفعّل تنبيهات أو بريدًا أو Push.'],
    ['الاستضافة والمصادر الخارجية', 'قد تحتفظ الاستضافة بسجلات الطلبات والأخطاء وفق إعداداتها وسياساتها. حماية معدل الطلبات المؤقتة قد تستخدم عنوان الاتصال؛ لا توجد إضافة تحليلات أو معرّف تتبع جديد لهذه الميزة. صور الشعارات وروابط الأخبار ومشغّلات البث الاختيارية تتصل بمصادرها الخارجية، وتسري سياساتها عند استخدامها.'],
    ['الإيقاف والمسح', 'يمكنك إيقاف تخصيص الرئيسية دون فقد اهتماماتك، أو إلغاء متابعة عنصر منفرد، أو تأكيد مسح جميع التفضيلات المحلية من مساحتك. الحسابات السحابية غير مفعّلة حاليًا؛ لا توجد بيانات حساب لحذفها أو خدمة تسجيل تم الاشتراك فيها تلقائيًا.'],
  ] : [
    ['What is stored?', 'Personalisation is optional. localStorage key korascore:preferences:v1 contains the teams, competitions and players you select, public display facts from the football catalogue, and the dashboard visibility setting. The limit is 60 interests. This is not an account: we do not ask for your name, email, photo or password.'],
    ['Language and time zone', 'NEXT_LOCALE and KORA_TZ cookies retain your language and time-zone choices for up to a year. They are display preferences, not tracking identifiers. The reset in My space removes interests and personalisation only; remove the language/time-zone cookies through your browser settings if desired.'],
    ['When do interests reach the server?', 'Only when you open the home page with personalisation enabled: team and competition references are sent in a request body to filter public football data. They are not added to the page URL or application logs. No preference profile or user identity is stored in a database. Personalised responses use private/no-store and are never cached by the service worker.'],
    ['Storage and coverage limits', 'This browser’s preferences do not sync to other devices and can be removed when you clear browser storage. Private or quota-full storage may work only for the current visit; the interface warns you. Player links rely on available squads/scorer lists that can change over time. Following does not enable notifications, email or Push.'],
    ['Hosting and external sources', 'The hosting provider may retain request and error logs under its own configuration and policies. Temporary request limiting may use the connecting address; this feature adds no analytics service or tracking identifier. Crest images, publisher links and optional broadcast players connect to their external providers, whose policies apply when used.'],
    ['Switching off and clearing', 'Disable home personalisation without losing interests, unfollow one entry, or explicitly confirm clearing all local preferences in My space. Cloud accounts are not activated: there is no account data to delete and no automatic sign-up to an external service.'],
  ];
  return (
    <div className="container-page max-w-3xl space-y-6 py-8">
      <header><p className="eyebrow mb-3">KoraScore</p><h1 className="text-2xl font-extrabold text-white">{t.privacyLink}</h1><p className="mt-3 text-xs text-slate-500">{locale === 'ar' ? 'آخر تحديث: ١ أكتوبر ٢٠٢٦ · التخصيص المحلي' : 'Updated: 1 October 2026 · local personalisation'}</p></header>
      <div className="card divide-y divide-navy-700/60 px-5 sm:px-6">
        {sections.map(([title, body]) => <section key={title} className="py-5"><h2 className="mb-3 text-base font-bold text-slate-200">{title}</h2><p className="text-sm leading-8 text-slate-400">{body}</p></section>)}
      </div>
      <Link href={`/${locale}/profile`} prefetch={false} className="btn-primary">{t.profile}</Link>
    </div>
  );
}

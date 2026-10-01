import type { Locale } from '@/i18n/locales';
import type { PreferencesSnapshot } from '../lib/store';
import { getPersonalCopy } from '../lib/copy';

export function StorageNotice({ persistence, locale }: { persistence: PreferencesSnapshot['persistence']; locale: Locale }) {
  const t = getPersonalCopy(locale);
  const message = persistence === 'memory' ? t.storageMemory : persistence === 'repaired' ? t.storageRepaired : persistence === 'unsupported' ? t.storageUnsupported : null;
  return message ? <p role="status" className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-sm leading-7 text-amber-200">{message}</p> : null;
}

import { renderShareImage } from '../../../../../../../src/features/share-cards/lib/server';
import { serveShareImage } from '../../../../../../../src/features/share-cards/lib/image-http';
import { cardSnapshot } from '../../card-data';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ scenario: string }> }) {
  const { scenario } = await params;
  return serveShareImage(request, { locale: scenario.startsWith('ar') ? 'ar' : 'en', id: 'fd~990001' }, {
    getMatch: async () => scenario.includes('unavailable') ? null : cardSnapshot(scenario),
    render: renderShareImage, limit: () => ({ ok: true, retryAfterSeconds: 0 }),
  });
}

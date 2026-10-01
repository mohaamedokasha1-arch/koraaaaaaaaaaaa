import type { Metadata } from 'next';
import CardFixture from './CardFixture';

export const metadata: Metadata = { title: 'Isolated share-card tests', robots: { index: false, follow: false } };
export default async function CardsPage({ params }: { params: Promise<{ scenario: string }> }) {
  return <CardFixture scenario={(await params).scenario} />;
}

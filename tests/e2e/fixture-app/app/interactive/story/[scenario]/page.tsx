import type { Metadata } from 'next';
import StoryFixture from './StoryFixture';

export const metadata: Metadata = { title: 'Isolated Match Story tests', robots: { index: false, follow: false } };
export default async function StoryFixturePage({ params }: { params: Promise<{ scenario: string }> }) {
  const { scenario } = await params;
  return <StoryFixture scenario={scenario} />;
}

import { LiveIcon } from '../components/LiveIcon';

/** A normal outbound link — never an iframe, redirect resolver or video proxy. */
export function ExternalAdapter({ url, label }: { url: string; label: string }) {
  return <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3 w-full !text-xs">{label}<LiveIcon name="external" className="h-4 w-4" /></a>;
}

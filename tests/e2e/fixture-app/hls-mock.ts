/** Test-only adapter double, used solely by the fixture app's bundler alias. */
declare global { interface Window { __liveHlsRecoveries?: number } }
type Handler = (event: string, data: { fatal: boolean; type: string }) => void;
export default class MockHls {
  static Events = { MANIFEST_PARSED: 'manifest', FRAG_LOADING: 'frag-loading', FRAG_LOADED: 'frag-loaded', ERROR: 'error' };
  static ErrorTypes = { MEDIA_ERROR: 'media' };
  static isSupported() { return true; }
  private handlers = new Map<string, Handler[]>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  constructor(_config: unknown) {}
  on(event: string, callback: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]); }
  loadSource(_source: string) {}
  attachMedia(_media: HTMLVideoElement) { this.timers.push(setTimeout(() => this.fatal(), 50)); }
  recoverMediaError() {
    window.__liveHlsRecoveries = (window.__liveHlsRecoveries ?? 0) + 1;
    this.timers.push(setTimeout(() => this.fatal(), 50));
  }
  destroy() { this.timers.forEach(clearTimeout); this.handlers.clear(); }
  private fatal() { this.handlers.get('error')?.forEach((handler) => handler('error', { fatal: true, type: 'media' })); }
}

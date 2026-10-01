import type { Stream } from '../types/index.ts';
export interface AdapterEvents {
  onLoaded: () => void;
  onWorking: () => void;
  onSlow: () => void;
  onFailure: () => void;
}
export interface AdapterProps extends AdapterEvents { stream: Stream; title: string }

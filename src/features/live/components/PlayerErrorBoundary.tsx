'use client';

import { Component, type ReactNode } from 'react';
import type { Locale } from '@/i18n/locales';
import { getLiveCopy } from '../lib/copy.ts';

export class PlayerErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode; locale: Locale }, { failed: boolean; reset: number }> {
  state = { failed: false, reset: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      const t = getLiveCopy(this.props.locale);
      return <div className="space-y-4"><div role="alert" className="card p-6"><p className="text-sm text-slate-200">{t.playerError}</p><button type="button" className="btn-ghost mt-4" onClick={() => this.setState({ failed: false, reset: this.state.reset + 1 })}>{t.retry}</button></div>{this.props.fallback}</div>;
    }
    return <div key={this.state.reset}>{this.props.children}</div>;
  }
}

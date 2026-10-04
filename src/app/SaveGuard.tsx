import { Component } from 'react';
import type { ReactNode } from 'react';
import { SAVE_KEY } from '../store/gameStore';

/** If the screen crashes — most likely a saved game this version can't read —
    offer a way out instead of a blank page. */
export default class SaveGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('The Exchange crashed:', error); }

  render() {
    if (!this.state.failed) return this.props.children;
    const startFresh = () => {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing saved */ }
      window.location.reload();
    };
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--bg)', color: '#f0e8d8' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>The game couldn't be shown</h1>
          <p style={{ color: '#a99b88', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>
            The saved game on this device may be from an older version of The Exchange.
            Starting fresh clears that save; your sound and board settings stay.
          </p>
          <button className="primary" onClick={startFresh} style={{ padding: '10px 18px' }}>Start fresh</button>
        </div>
      </main>
    );
  }
}

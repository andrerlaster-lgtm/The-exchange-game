import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './index.css';

// Expose store for dev/QA tooling only.
if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  import('./store/gameStore').then(({ useGameStore }) => {
    (window as unknown as Record<string, unknown>).__store = useGameStore;
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

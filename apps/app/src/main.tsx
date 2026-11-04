import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from '@unclutterdesk/ui';
import { App } from './App';
// The design system's faces (Figtree, Fraunces), before the tokens that name them.
import '@unclutterdesk/ui/src/brand/therapysts/fonts.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);

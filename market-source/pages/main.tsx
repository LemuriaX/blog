import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import Home from '../app/page';
import '../app/globals.css';

// Vinext may inspect this static entry during its server build.
if (typeof document !== 'undefined') {
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Root element not found');
  }

  createRoot(root).render(
    <StrictMode>
      <Home />
    </StrictMode>,
  );
}

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installMatchMedia } from './matchMedia';

// jsdom has no matchMedia; every test starts at desktop width.
installMatchMedia(1280);
afterEach(() => {
  cleanup();
  installMatchMedia(1280);
});

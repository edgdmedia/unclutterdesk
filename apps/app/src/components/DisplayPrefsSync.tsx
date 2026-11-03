import { setActiveDisplayPrefs, useDisplayFormat } from '../utils/displayFormat';

/**
 * Keeps formatWhen/formatClock on the signed-in person's preferences.
 * Set during render, so the pages rendered inside the frame already see it.
 * Renders nothing.
 */
export function DisplayPrefsSync() {
  const { prefs } = useDisplayFormat();
  setActiveDisplayPrefs(prefs);
  return null;
}

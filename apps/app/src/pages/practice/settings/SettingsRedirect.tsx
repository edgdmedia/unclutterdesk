import { Navigate, useParams } from 'react-router-dom';

/**
 * Redirect component for old settings URLs. Preserves the full path including
 * any dynamic params (e.g., /dashboard/settings/forms/:id).
 */
export function SettingsRedirect({ to }: { to: string }) {
  const params = useParams<Record<string, string>>();
  // Build the target URL with any params
  let target = to;
  for (const [key, value] of Object.entries(params)) {
    target = target.replace(`:${key}`, value);
  }
  return <Navigate to={target} replace />;
}
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ProfileSignupPage } from './ProfileSignupPage';

/** /signup: signed-in people go to their home; otherwise the profile-first form for ?intent=profile, or the practice signup (query kept). */
export function SignupEntry() {
  const location = useLocation();
  const { profile, isLoading } = useAuth();
  // Already signed in: go where sign-in would have taken them, not to a signup form.
  if (isLoading) return null;
  if (profile) {
    const home = profile.type === 'platform_admin' ? '/admin' : profile.type === 'user' ? '/portal' : '/dashboard';
    return <Navigate to={home} replace />;
  }
  const params = new URLSearchParams(location.search);
  if (params.get('intent') === 'profile') return <ProfileSignupPage />;
  return <Navigate to={`/auth/signup${location.search}`} replace />;
}

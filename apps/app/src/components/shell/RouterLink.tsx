import { Link } from 'react-router-dom';
import type { LinkLikeProps } from '@unclutterdesk/ui';

/** Shared navigation renders links through this, so moving between pages never reloads the app. */
export function RouterLink({ href, children, ...rest }: LinkLikeProps) {
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}

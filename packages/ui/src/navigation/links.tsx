import type { ComponentType, ReactNode } from 'react';

export interface LinkLikeProps {
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  'aria-label'?: string;
  'aria-current'?: 'page';
  onClick?: () => void;
}

/** How navigation components render a link. The app passes one backed by its router. */
export type LinkLike = ComponentType<LinkLikeProps>;

export const PlainLink: LinkLike = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

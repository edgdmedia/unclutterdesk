import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import { BrandProvider, ToastProvider, type TenantBrandConfig } from '@unclutterdesk/ui';

export * from '@testing-library/react';

/**
 * Renders a page the way the app does: inside the router, the practice's brand
 * and the toast system, all real. Tests fake only the network (utils/apiClient);
 * nothing of ours is swapped for a stand-in.
 */
export function renderWithApp(
  ui: ReactElement,
  { route = '/', brand = null }: { route?: string; brand?: TenantBrandConfig | null } = {},
): RenderResult {
  const Providers = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <BrandProvider brand={brand}>
        <ToastProvider>{children}</ToastProvider>
      </BrandProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Providers });
}

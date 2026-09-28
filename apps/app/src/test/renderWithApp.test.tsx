import { describe, expect, it } from 'vitest';
import { useLocation } from 'react-router-dom';
import { useBrand, useToast } from '@unclutterdesk/ui';
import { renderWithApp, screen, fireEvent } from './renderWithApp';

function Probe() {
  const brand = useBrand();
  const toast = useToast();
  const location = useLocation();
  return (
    <div>
      <span>{`brand:${brand.name}`}</span>
      <span>{`at:${location.pathname}`}</span>
      <button onClick={() => toast.success('Saved')}>Toast</button>
    </div>
  );
}

describe('renderWithApp', () => {
  it('provides the real router, brand and toasts', async () => {
    renderWithApp(<Probe />, { route: '/dashboard/clients', brand: { name: 'Calm Practice', primaryColor: '#123456' } as any });
    expect(screen.getByText('brand:Calm Practice')).toBeTruthy();
    expect(screen.getByText('at:/dashboard/clients')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Toast' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
  });
});

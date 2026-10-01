import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const post = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: vi.fn(), post: (...a: unknown[]) => post(...a) } }));
let signedIn: any = null;
const login = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: signedIn, isAuthenticated: !!signedIn, login }),
}));

const { ClientAuthPanel } = await import('../public/ClientAuthPanel');

beforeEach(() => { post.mockReset(); login.mockReset(); signedIn = null; post.mockResolvedValue({ profile: { id: '40', role: 'CLIENT' } }); });
afterEach(cleanup);

describe('ClientAuthPanel', () => {
  it('offers both ways in, defaulting to create', () => {
    renderWithApp(<ClientAuthPanel onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.queryByLabelText('First name')).toBeNull();
  });
  it('creates the account and reports done', async () => {
    const onDone = vi.fn();
    renderWithApp(<ClientAuthPanel onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and continue' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/auth/client-signup', expect.objectContaining({ email: 'ada@x.com' })));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
  it('flips to Sign in when an account already exists', async () => {
    post.mockRejectedValueOnce(new Error('You already have an account at this practice. Sign in to continue.'));
    renderWithApp(<ClientAuthPanel onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@x.com' } });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and continue' }));
    await waitFor(() => expect(screen.getByText(/already have an account/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Sign in' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('explains that one account works everywhere and each practice sees only its own records', async () => {
    renderWithApp(<ClientAuthPanel onDone={() => {}} />);
    expect(await screen.findByText('Use the same account with any practice on Unclutter Desk. Each practice only sees its own records.')).toBeTruthy();
  });
  it('signs in through the shared login', async () => {
    const onDone = vi.fn();
    renderWithApp(<ClientAuthPanel onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in and continue' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('ada@x.com', 'password1234'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('asks for a phone number when creating an account, and says one account works everywhere', async () => {
    const onDone = vi.fn();
    renderWithApp(<ClientAuthPanel onDone={onDone} />);
    expect(screen.getByText(/One Unclutter Desk account works with every practice/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@x.com' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0801 234 5678' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and continue' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/auth/client-signup', expect.objectContaining({ phone: '0801 234 5678' })));
  });
});

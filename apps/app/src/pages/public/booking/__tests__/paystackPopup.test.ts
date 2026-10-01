import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  document.head.innerHTML = '';
  delete (window as any).PaystackPop;
});

// Paystack's script is the network boundary: the test stands in for what it puts on window.
function fakePaystack(outcome: 'onSuccess' | 'onCancel' | 'onError') {
  const resumeTransaction = vi.fn((_code: string, cb: Record<string, (x?: unknown) => void>) => cb[outcome]({ reference: 'booking-900-1' }));
  (window as any).PaystackPop = vi.fn(() => ({ resumeTransaction }));
  return resumeTransaction;
}

describe('Paystack pop-up', () => {
  it('resumes the transaction with the access code and reports success', async () => {
    const resume = fakePaystack('onSuccess');
    const { payInPopup } = await import('../paystackPopup');
    await expect(payInPopup('ac_123')).resolves.toBe('success');
    expect(resume).toHaveBeenCalledWith('ac_123', expect.any(Object));
  });

  it('reports a closed pop-up as cancelled', async () => {
    fakePaystack('onCancel');
    const { payInPopup } = await import('../paystackPopup');
    await expect(payInPopup('ac_123')).resolves.toBe('cancelled');
  });

  it('fails clearly when Paystack errors', async () => {
    fakePaystack('onError');
    const { payInPopup } = await import('../paystackPopup');
    await expect(payInPopup('ac_123')).rejects.toThrow(/payment/i);
  });

  it("loads Paystack's script once when it isn't on the page yet", async () => {
    const { payInPopup } = await import('../paystackPopup');
    const pending = payInPopup('ac_123');
    const script = document.head.querySelector('script[src="https://js.paystack.co/v2/inline.js"]') as HTMLScriptElement;
    expect(script).toBeTruthy();
    fakePaystack('onSuccess');
    script.onload?.(new Event('load'));
    await expect(pending).resolves.toBe('success');
    expect(document.head.querySelectorAll('script').length).toBe(1);
  });
});

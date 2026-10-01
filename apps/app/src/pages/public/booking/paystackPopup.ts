const SRC = 'https://js.paystack.co/v2/inline.js';

type PaystackCallbacks = {
  onSuccess: (tx: unknown) => void;
  onCancel: () => void;
  onError: (err: unknown) => void;
};
type PaystackPopCtor = new () => { resumeTransaction: (accessCode: string, callbacks: PaystackCallbacks) => void };

let loading: Promise<void> | null = null;

function paystackPop(): PaystackPopCtor | undefined {
  return (window as unknown as { PaystackPop?: PaystackPopCtor }).PaystackPop;
}

/** Adds Paystack's script to the page once; later calls wait on the same load. */
function loadScript(): Promise<void> {
  if (paystackPop()) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error('Could not open the payment window. Check your connection and try again.'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Opens Paystack's checkout over the page, for a transaction the API already started. */
export async function payInPopup(accessCode: string): Promise<'success' | 'cancelled'> {
  await loadScript();
  const Pop = paystackPop();
  if (!Pop) throw new Error('Could not open the payment window. Check your connection and try again.');
  return new Promise((resolve, reject) => {
    new Pop().resumeTransaction(accessCode, {
      onSuccess: () => resolve('success'),
      onCancel: () => resolve('cancelled'),
      onError: () => reject(new Error('The payment could not be completed.')),
    });
  });
}

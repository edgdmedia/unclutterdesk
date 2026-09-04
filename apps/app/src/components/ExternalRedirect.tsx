import { useEffect } from 'react';

/**
 * Sends a route straight out to another site.
 *
 * `/privacy` and `/terms` are kept as app routes because they are linked from
 * elsewhere and people bookmark them, but the documents themselves live on the
 * marketing site. `replace` rather than `assign` so the back button returns to
 * where the reader actually came from instead of bouncing them out again.
 */
export function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-6">
      <p className="text-sm font-medium text-[#64748B]">
        Opening <a href={to} className="font-bold text-[#0F3A53] underline">{to}</a>…
      </p>
    </div>
  );
}

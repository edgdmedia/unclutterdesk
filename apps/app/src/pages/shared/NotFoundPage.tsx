import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

/**
 * Shown for any route the app does not recognise.
 *
 * The app is a single-page app served with an index.html fallback, so deep
 * links like /dashboard/clients keep working — which means the HTTP status for
 * an unknown path is unavoidably 200. This page therefore sets a noindex tag
 * while it is mounted, so a crawler that follows a stale link does not index a
 * "not found" screen as if it were real content. The marketing site, being
 * static, returns a genuine 404 instead.
 */
export function NotFoundPage({ homeHref = '/' }: { homeHref?: string }) {
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]');
    // Remember what was there so tenant booking pages stay indexable after the
    // visitor navigates away from this screen.
    const previous = existing?.getAttribute('content') ?? null;

    const meta = existing ?? document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex, follow');
    if (!existing) document.head.appendChild(meta);

    return () => {
      if (previous === null) {
        meta.remove();
      } else {
        meta.setAttribute('content', previous);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#EFF3F7] text-[#0F172A] font-outfit flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#0F3A53]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[520px] bg-white rounded-[24px] p-[38px_40px_32px] shadow-[0_24px_80px_rgba(15,23,42,.14)] text-center space-y-6 relative z-10 border border-[#E2E8F0]">
        <div className="h-[64px] w-[64px] rounded-[20px] bg-[#F1F5F9] text-[#0F3A53] flex items-center justify-center mx-auto border border-[#E2E8F0]">
          <Compass className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#64748B] uppercase m-0">Error 404</p>
          <h1 className="text-[22px] font-bold text-[#0F172A] leading-tight m-0">
            We couldn't find that page
          </h1>
          <p className="text-sm text-[#64748B] leading-relaxed m-0">
            The link may be out of date, or the address may have a typo in it.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to={homeHref}
            className="inline-flex items-center justify-center gap-2 h-[48px] px-6 rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold hover:opacity-90 transition-opacity no-underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to safety
          </Link>
        </div>
      </div>
    </div>
  );
}

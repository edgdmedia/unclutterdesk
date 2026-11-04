import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Card, Input, useToast } from '@unclutterdesk/ui';
import { profilePath } from '../../../config/domains';
import { ENTITLEMENT_REQUIRED_EVENT, api, apiDownload } from '../../../utils/apiClient';
import { PROFILE_FEATURE_TIERS, useProfileEntitlements } from '../../../utils/entitlements';
import { KIND_LABELS, profileApi, type OwnProfile } from './profileApi';
import { emailSignature } from './emailSignature';

/**
 * The Share tab (§6.10): the public link, WhatsApp share, QR download, the
 * one-page PDF (paid plans) and an email signature.
 *
 * Every address comes from profilePath(handle) or the API's own share
 * endpoints. There is no handle or id in any request, so a practitioner can
 * only ever get their own QR and PDF.
 */
export function ShareKit() {
  const [profile, setProfile] = useState<OwnProfile | null | undefined>(undefined);
  const [copied, setCopied] = useState<'link' | 'signature' | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const entitlements = useProfileEntitlements();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    profileApi
      .getOwn()
      .then((p) => !cancelled && setProfile(p))
      .catch(() => !cancelled && setProfile(null));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const url = profile ? profilePath(profile.handle) : '';
  const signature = useMemo(
    () => (profile ? emailSignature({ name: profile.displayName, kindLabel: KIND_LABELS[profile.kind], url }) : ''),
    [profile, url],
  );

  if (profile === undefined) {
    return <p className="text-[13px] text-[var(--desk-text-muted)]">Loading your share kit…</p>;
  }
  if (profile === null) {
    return (
      <Card padding="lg">
        <p className="text-[14px] text-[var(--desk-text-body)]">
          Start your public profile first — the share kit builds every link from it.
        </p>
      </Card>
    );
  }

  const published = profile.status === 'PUBLISHED';
  const message = `I now have a profile on Therapysts where you can learn about my work and get in touch: ${url}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const copy = async (text: string, which: 'link' | 'signature') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.');
    }
  };

  /**
   * Downloads through the app's API client, which sends the session cookie and
   * saves the blob; the URL is never built by hand. A failed download says so
   * instead of leaving an unhandled rejection.
   */
  const download = async (key: string, path: string, filename: string) => {
    setDownloading(key);
    try {
      await apiDownload(path, filename);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The download did not start. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card padding="lg" className="xl:col-span-2">
        <h2 className="text-[15px] font-bold text-[var(--desk-text)]">Your profile link</h2>
        {!published && (
          <p className="mt-1 text-[13px] text-[var(--desk-pending)]">The link works once your profile is published.</p>
        )}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input label="Your profile link" readOnly value={url} onFocus={(e: any) => e.target.select()} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void copy(url, 'link')}>
              {copied === 'link' ? 'Link copied' : 'Copy link'}
            </Button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[44px] items-center justify-center rounded-[12px] bg-[#25D366] px-4 text-[13px] font-bold text-[#0B2E13]"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-[var(--desk-text-muted)]">
          <span className="font-semibold text-[var(--desk-text-body)]">Instagram bio tip:</span> paste this link into your
          Instagram bio so people can find your profile from your posts.
        </p>
      </Card>

      <Card padding="lg">
        <h2 className="text-[15px] font-bold text-[var(--desk-text)]">QR code</h2>
        <p className="mt-1 text-[13px] text-[var(--desk-text-body)]">
          Put it on a business card, a flyer or a slide. It points at your profile.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={downloading !== null}
            onClick={() =>
              void download('qr-png', `/v1/practitioner-profile/me/share/qr?format=png`, `${profile.handle}-qr.png`)
            }
          >
            Download QR (PNG)
          </Button>
          <Button
            variant="ghost"
            disabled={downloading !== null}
            onClick={() =>
              void download('qr-svg', `/v1/practitioner-profile/me/share/qr?format=svg`, `${profile.handle}-qr.svg`)
            }
          >
            Download QR (SVG)
          </Button>
        </div>
      </Card>

      <Card padding="lg">
        <h2 className="text-[15px] font-bold text-[var(--desk-text)]">Profile PDF</h2>
        {entitlements?.downloadablePdf ? (
          <>
            <p className="mt-1 text-[13px] text-[var(--desk-text-body)]">
              A one-page sheet with your photo, qualifications, specialties and QR code.
            </p>
            <div className="mt-4">
              <Button
                disabled={downloading !== null}
                onClick={() =>
                  void download('pdf', '/v1/practitioner-profile/me/share/pdf', `${profile.handle}-profile.pdf`)
                }
              >
                Download profile PDF
              </Button>
            </div>
          </>
        ) : (
          <LockedFeature
            title="A printable one-page profile"
            body="The PDF is part of a paid plan. Everything else in the share kit is yours on the free plan."
            explanation="A printable one-page PDF of your profile is part of the {plan} plan."
            feature="downloadablePdf"
            planLabel={planLabel(PROFILE_FEATURE_TIERS.downloadablePdf)}
          />
        )}
      </Card>

      <Card padding="lg" className="xl:col-span-2">
        <h2 className="text-[15px] font-bold text-[var(--desk-text)]">Email signature</h2>
        <p className="mt-1 text-[13px] text-[var(--desk-text-body)]">
          Paste this under your emails in Gmail, Outlook or Apple Mail. Every line is styled inline, so it
          looks the same everywhere.
        </p>
        <div className="mt-4 rounded-[12px] border border-[var(--desk-border)] bg-white p-4" aria-label="Email signature preview">
          <div dangerouslySetInnerHTML={{ __html: signature }} />
        </div>
        <div className="mt-3">
          <Button variant="secondary" onClick={() => void copy(signature, 'signature')}>
            {copied === 'signature' ? 'HTML copied' : 'Copy HTML'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function planLabel(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

function LockedFeature({
  title,
  body,
  explanation,
  feature,
  planLabel: plan,
}: {
  title: string;
  body: ReactNode;
  explanation: string;
  feature: 'downloadablePdf';
  planLabel: string;
}) {
  const openPrompt = () => {
    const message = explanation.replace('{plan}', plan);
    window.dispatchEvent(
      new CustomEvent(ENTITLEMENT_REQUIRED_EVENT, {
        detail: { requiredTier: PROFILE_FEATURE_TIERS[feature], feature, scope: 'profile', message },
      }),
    );
  };

  return (
    <>
      <div className="mt-4 rounded-[14px] border border-dashed border-[var(--desk-pine-200)] bg-[var(--desk-surface)] p-6 text-center">
        <div className="mx-auto h-16 w-12 rounded-[4px] border border-[var(--desk-pine-200)] bg-white shadow-sm" aria-hidden="true" />
        <p className="mt-3 text-[13px] font-semibold text-[var(--desk-text-body)]">{title}</p>
        <p className="mt-1 text-[12.5px] text-[var(--desk-text-muted)]">{body}</p>
        <p className="mt-2 text-[12px] font-bold text-[var(--desk-pine-600)]">Part of the {plan} plan</p>
      </div>
      <div className="mt-3">
        <Button variant="secondary" onClick={openPrompt}>
          See the {plan} plan
        </Button>
      </div>
    </>
  );
}
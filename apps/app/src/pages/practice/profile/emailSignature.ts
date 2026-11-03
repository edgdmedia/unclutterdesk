export interface EmailSignatureInput {
  name: string;
  kindLabel: string;
  url: string;
}

/** The characters that matter in an HTML text node or attribute value. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * A copy-paste email signature (§6.10): shown as a live preview in the share
 * tab and copied as HTML into Gmail, Outlook or Apple Mail.
 *
 * Email clients strip <style> blocks, so every rule is inline. Every value is
 * escaped, and only an https address becomes a link: anything else is shown as
 * inert text, so a pasted javascript: URL cannot become a clickable trap.
 */
export function emailSignature({ name, kindLabel, url }: EmailSignatureInput): string {
  const safeName = escapeHtml(name);
  const safeKind = escapeHtml(kindLabel);
  const safeUrl = escapeHtml(url);
  const link = isHttpsUrl(url)
    ? `<a href="${safeUrl}" style="color:#0F3A53;text-decoration:none;">${safeUrl}</a>`
    : `<span style="color:#475569;">${safeUrl}</span>`;

  return [
    '<table cellpadding="0" cellspacing="0" border="0" style="font-family:Helvetica,Arial,sans-serif;color:#0F172A;font-size:13px;line-height:1.5;">',
    '<tr>',
    '<td style="padding:0 0 2px 0;font-size:15px;font-weight:bold;color:#0F172A;">',
    safeName,
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="padding:0 0 6px 0;color:#475569;">',
    safeKind,
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="padding:0;">',
    '<span style="color:#64748B;">Profile:</span> ',
    link,
    '</td>',
    '</tr>',
    '</table>',
  ].join('');
}
import { BadRequestException } from '@nestjs/common';
import { toString as qrToString, toBuffer as qrToBuffer } from 'qrcode';

export type QrFormat = 'svg' | 'png';

/**
 * A QR code for a public profile address (§6.10).
 *
 * The address is the only thing encoded, and it must be an https link: a QR
 * carrying any other scheme would be a clickable trap once scanned. The SVG is
 * pure markup (qrcode emits no script), so it can be embedded anywhere.
 */
export async function profileQr(url: string, format: QrFormat): Promise<Buffer | string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('The profile address must be a full https link');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new BadRequestException('The profile address must be a full https link');
  }
  const target = parsed.toString();

  if (format === 'svg') {
    return qrToString(target, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
  }
  if (format === 'png') {
    return qrToBuffer(target, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 1024 });
  }
  throw new BadRequestException('format must be svg or png');
}
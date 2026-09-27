import * as pdfkit from 'pdfkit';
import type PDFKit from 'pdfkit';

// pdfkit is CommonJS (module.exports = PDFDocument). The build has no
// default-import interop, so resolve the constructor either way; a plain
// default import compiled to "pdfkit_1.default", which is undefined.
const PDFDocument = ((pdfkit as any).default ?? pdfkit) as typeof PDFKit;
import { CATEGORY_LABEL, HOURS_CATEGORIES, HoursRow, hoursText, initialsOf, isHoursCategory, isoDate, totalsOf } from './hours-format';

export interface HoursPdfHeader {
  practiceName: string;
  practitionerName: string;
  targetLabel?: string | null;
  totalTargetHours?: number | null;
  supervisionTargetHours?: number | null;
  generatedAt?: Date;
}

const INK = '#0F172A';
const MUTED = '#64748B';
const RULE = '#E2E8F0';

/**
 * A printable hours log: header, totals by category, every entry, and lines
 * for the practitioner and supervisor to sign. Client names are initials
 * unless fullNames is set, because the document leaves the clinic.
 */
export function hoursPdf(rows: HoursRow[], header: HoursPdfHeader, { fullNames = false }: { fullNames?: boolean } = {}): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Hours log: ${header.practitionerName}` } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totals = totalsOf(rows);
  const generatedAt = header.generatedAt ?? new Date();

  // Header
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('Clinical hours log', left, 48);
  doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor(MUTED);
  doc.text(`${header.practitionerName} · ${header.practiceName}`);
  if (header.targetLabel) doc.text(header.targetLabel);
  const span = rows.length ? `${isoDate(rows[0].date)} to ${isoDate(rows[rows.length - 1].date)}` : 'No entries';
  doc.text(`${span} · generated ${isoDate(generatedAt)}`);

  // Totals
  doc.moveDown(1).fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Totals');
  doc.moveDown(0.3).font('Helvetica').fontSize(10);
  const target = (label: string, minutes: number, targetHours?: number | null) =>
    `${label}: ${hoursText(minutes)} h${targetHours ? ` of ${targetHours} h (${Math.min(100, Math.round((minutes / 60 / targetHours) * 100))}%)` : ''}`;
  doc.text(target('All hours', totals.totalMinutes, header.totalTargetHours));
  doc.text(target('Client hours (direct and group)', totals.clientMinutes));
  doc.text(target('Supervision', totals.supervisionMinutes, header.supervisionTargetHours));
  for (const c of HOURS_CATEGORIES) {
    if (totals.byCategory[c]) doc.fillColor(MUTED).text(`   ${CATEGORY_LABEL[c]}: ${hoursText(totals.byCategory[c])} h`);
  }
  doc.fillColor(INK);

  // Table
  const cols = [
    { title: 'Date', w: 66 },
    { title: 'Client', w: fullNames ? 104 : 50 },
    { title: 'Category', w: 104 },
    { title: 'Hours', w: 40 },
    { title: 'Supervisor', w: 76 },
  ];
  const notesW = width - cols.reduce((a, c) => a + c.w, 0);
  const allCols = [...cols, { title: 'Notes', w: notesW }];

  const drawHead = () => {
    let x = left;
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED);
    for (const c of allCols) {
      doc.text(c.title.toUpperCase(), x, y, { width: c.w - 6 });
      x += c.w;
    }
    doc.moveTo(left, doc.y + 3).lineTo(left + width, doc.y + 3).strokeColor(RULE).stroke();
    doc.y += 7;
    doc.font('Helvetica').fontSize(9).fillColor(INK);
  };

  doc.moveDown(1.2).fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Entries', left);
  doc.moveDown(0.4);
  drawHead();

  for (const r of rows) {
    const cells = [
      isoDate(r.date),
      (fullNames ? r.clientName : initialsOf(r.clientName)) || '—',
      isHoursCategory(r.category) ? CATEGORY_LABEL[r.category] : r.category,
      hoursText(r.durationMinutes),
      r.supervisorName ?? '',
      [r.source === 'MANUAL' ? 'Manual' : '', r.notes ?? ''].filter(Boolean).join(' · '),
    ];
    const heights = cells.map((text, i) => doc.heightOfString(text, { width: allCols[i].w - 6 }));
    const rowH = Math.max(...heights) + 5;
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      drawHead();
    }
    const y = doc.y;
    let x = left;
    cells.forEach((text, i) => {
      doc.text(text, x, y, { width: allCols[i].w - 6 });
      x += allCols[i].w;
    });
    doc.y = y + rowH;
  }

  // Signatures
  if (doc.y > doc.page.height - doc.page.margins.bottom - 130) doc.addPage();
  doc.moveDown(2);
  const sigW = (width - 40) / 2;
  const sigY = doc.y + 30;
  doc.moveTo(left, sigY).lineTo(left + sigW, sigY).strokeColor(INK).stroke();
  doc.moveTo(left + sigW + 40, sigY).lineTo(left + width, sigY).stroke();
  doc.font('Helvetica').fontSize(9).fillColor(MUTED);
  doc.text(`Practitioner: ${header.practitionerName}`, left, sigY + 5, { width: sigW });
  doc.text('Supervisor: name and signature', left + sigW + 40, sigY + 5, { width: sigW });
  doc.text('Date:', left, sigY + 32, { width: sigW });
  doc.text('Date:', left + sigW + 40, sigY + 32, { width: sigW });

  doc.end();
  return done;
}

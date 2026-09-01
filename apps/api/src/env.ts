import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    config({ path: candidate, quiet: true });
  }
}

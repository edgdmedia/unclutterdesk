import fs from 'fs';
import path from 'path';

const dir = '/Users/olalekan/Projects/Unclutter/unclutterdesk/packages/ui/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Fix .jsx imports
  content = content.replace(/\.jsx(['"])/g, '$1');

  // Fix implicit any on props
  content = content.replace(/(export\s+function\s+[A-Za-z0-9_]+\s*\(\s*\{[^}]+\}\s*)(\))/g, '$1: any$2');
  content = content.replace(/(export\s+const\s+[A-Za-z0-9_]+\s*=\s*\(\s*\{[^}]+\}\s*)(\))/g, '$1: any$2');

  // Fix specific object indexing implicit any
  content = content.replace(/variants\[([^\]]+)\]/g, '(variants as any)[$1]');
  content = content.replace(/tones\[([^\]]+)\]/g, '(tones as any)[$1]');
  content = content.replace(/toneMap\[([^\]]+)\]/g, '(toneMap as any)[$1]');
  content = content.replace(/colorMap\[([^\]]+)\]/g, '(colorMap as any)[$1]');

  fs.writeFileSync(filePath, content);
}
console.log('Fixed TS files');

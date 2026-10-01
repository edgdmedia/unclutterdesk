import { ImageField } from './ImageField';

/** Choose, preview and remove the practice logo. Shared by setup and Brand settings. */
export function LogoField({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  return <ImageField value={value} onChange={onChange} label="logo" alt="Practice logo" />;
}

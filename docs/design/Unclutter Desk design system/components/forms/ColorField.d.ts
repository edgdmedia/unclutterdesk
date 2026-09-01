import * as React from 'react';

/**
 * A tenant brand-color field: native swatch with its chrome removed, role
 * label, and uppercase mono hex. Fires on both input and change so dragging
 * in the picker updates the booking preview continuously.
 *
 * @startingPoint section="Forms" subtitle="Tenant color field + five presets" viewport="700x180"
 */
export interface ColorFieldProps extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'onChange' | 'style'> {
  /** Role label above the hex, e.g. "Primary" / "Secondary". */
  label?: string;
  value?: string;
  onChange?: (hex: string) => void;
  style?: React.CSSProperties;
}
export declare function ColorField(props: ColorFieldProps): JSX.Element;

export interface BrandPreset { name: string; primary: string; secondary: string }

/** The five Brand Settings preset pairs. Values fixed; only the first label changed with the rename. */
export declare const BRAND_PRESETS: BrandPreset[];

export interface PresetSwatchesProps {
  /** Currently applied primary hex — the matching swatch gets the dark ring. */
  value?: string;
  onPick?: (preset: BrandPreset) => void;
  /** Default 30. */
  size?: number;
  style?: React.CSSProperties;
}
export declare function PresetSwatches(props: PresetSwatchesProps): JSX.Element;

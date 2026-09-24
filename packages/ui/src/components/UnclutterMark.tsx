// @ts-nocheck
import React from 'react';

interface UnclutterMarkProps {
  size?: number;
  className?: string;
  /** Drop the DESK badge where it would be too small to read (favicons, collapsed rails). */
  showBadge?: boolean;
}

/**
 * The Unclutter Desk mark, drawn to match assets/unclutterdesk-mark.svg.
 *
 * Pine tile, mint leaves, mint DESK badge. The badge is never gold and never
 * says anything but DESK: it used to read "OS", the old product name, and
 * because it was drawn rather than written, the rename missed it.
 */
export function UnclutterMark({ size = 32, className = '', showBadge = true }: UnclutterMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="116" fill="#1C4E3F" />
      <g
        transform="translate(248 244) scale(0.66) translate(-256 -280)"
        stroke="#F8FAFC"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M256 464C256 464 160 384 128 304C96 224 128 128 128 128C128 128 224 160 304 192C384 224 464 320 464 320C464 320 384 416 304 448C224 480 256 464 256 464Z"
          fill="#7DB8A5"
          fillOpacity="0.30"
        />
        <path
          d="M256 464C256 464 352 384 384 304C416 224 384 128 384 128C384 128 288 160 208 192C128 224 48 320 48 320C48 320 128 416 208 448C288 480 256 464 256 464Z"
          fill="#7DB8A5"
          fillOpacity="0.30"
        />
        <path d="M256 80V464" />
      </g>
      {showBadge && (
        <g transform="translate(276 336)">
          <rect width="176" height="76" rx="38" fill="#B6D8CC" />
          <text
            x="88"
            y="53"
            textAnchor="middle"
            fontFamily="Outfit, Inter, Helvetica, Arial, sans-serif"
            fontSize="40"
            fontWeight="800"
            letterSpacing="2"
            fill="#0E2A22"
          >
            DESK
          </text>
        </g>
      )}
    </svg>
  );
}

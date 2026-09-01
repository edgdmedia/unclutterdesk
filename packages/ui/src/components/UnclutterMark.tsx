// @ts-nocheck
import React from 'react';

interface UnclutterMarkProps {
  size?: number;
  className?: string;
}

/**
 * Official Unclutter Desk Mark
 * Geometric crystal/lotus SVG icon in deep navy (#0F3A53) with gold OS badge overlay.
 */
export function UnclutterMark({ size = 32, className = '' }: UnclutterMarkProps) {
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
      <rect width="512" height="512" rx="116" fill="#0F3A53" />
      <g
        transform="translate(248 244) scale(0.66) translate(-256 -280)"
        stroke="#F8FAFC"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M256 464C256 464 160 384 128 304C96 224 128 128 128 128C128 128 224 160 304 192C384 224 464 320 464 320C464 320 384 416 304 448C224 480 256 464 256 464Z"
          fill="#E3B341"
          fillOpacity="0.28"
        />
        <path
          d="M256 464C256 464 352 384 384 304C416 224 384 128 384 128C384 128 288 160 208 192C128 224 48 320 48 320C48 320 128 416 208 448C288 480 256 464 256 464Z"
          fill="#E3B341"
          fillOpacity="0.28"
        />
        <path d="M256 80V464" />
      </g>
      <g transform="translate(300 336)">
        <rect width="152" height="76" rx="38" fill="#E3B341" />
        <text
          x="76"
          y="53"
          textAnchor="middle"
          fontFamily="Outfit, Inter, Helvetica, Arial, sans-serif"
          fontSize="42"
          fontWeight="800"
          letterSpacing="1"
          fill="#0F3A53"
        >
          OS
        </text>
      </g>
    </svg>
  );
}

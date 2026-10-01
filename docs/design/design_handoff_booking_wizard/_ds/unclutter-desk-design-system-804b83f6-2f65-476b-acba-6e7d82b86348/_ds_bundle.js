/* @ds-bundle: {"format":4,"namespace":"UnclutterDeskDesignSystem_804b83","components":[{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"AvatarChip","sourcePath":"components/core/AvatarChip.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"STATUS","sourcePath":"components/core/StatusPill.jsx"},{"name":"StatusPill","sourcePath":"components/core/StatusPill.jsx"},{"name":"BarChart","sourcePath":"components/data/BarChart.jsx"},{"name":"ProgressRow","sourcePath":"components/data/ProgressRow.jsx"},{"name":"StatTile","sourcePath":"components/data/StatTile.jsx"},{"name":"ColorField","sourcePath":"components/forms/ColorField.jsx"},{"name":"BRAND_PRESETS","sourcePath":"components/forms/ColorField.jsx"},{"name":"PresetSwatches","sourcePath":"components/forms/ColorField.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SegmentedControl","sourcePath":"components/forms/SegmentedControl.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Toggle","sourcePath":"components/forms/Toggle.jsx"},{"name":"AppHeader","sourcePath":"components/navigation/AppHeader.jsx"},{"name":"BottomNav","sourcePath":"components/navigation/BottomNav.jsx"},{"name":"NavItem","sourcePath":"components/navigation/NavItem.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"}],"sourceHashes":{"components/brand/Logo.jsx":"694bceaee6d6","components/core/AvatarChip.jsx":"52f0d21b8dfa","components/core/Badge.jsx":"8b587cd01268","components/core/Button.jsx":"fe91fc926ae6","components/core/Card.jsx":"866c03548441","components/core/Eyebrow.jsx":"478aa9c58db0","components/core/IconButton.jsx":"bdcb3e620955","components/core/StatusPill.jsx":"2e4029c248b3","components/data/BarChart.jsx":"dc65113d59dc","components/data/ProgressRow.jsx":"29b35c269d2a","components/data/StatTile.jsx":"88c2d75e2ffc","components/forms/ColorField.jsx":"78b8b6d8df8a","components/forms/Input.jsx":"ad70c7d8f470","components/forms/SegmentedControl.jsx":"7c014daeadf8","components/forms/Textarea.jsx":"57f8fc52fed7","components/forms/Toggle.jsx":"3dec3258eaf5","components/navigation/AppHeader.jsx":"79aee17cfc1e","components/navigation/BottomNav.jsx":"f6e8654f205e","components/navigation/NavItem.jsx":"9657236ad54f","components/navigation/Sidebar.jsx":"2664f2d10aad","ui_kits/_shared/load-components.js":"34f78a068464","ui_kits/booking/Booking.jsx":"428ef60f44a2","ui_kits/booking/app.jsx":"1c536618e3f0","ui_kits/mobile/Screens.jsx":"b33d53782ebd","ui_kits/mobile/app.jsx":"267999a589e2","ui_kits/workspace/Analytics.jsx":"0ac350940269","ui_kits/workspace/BrandSettings.jsx":"12f336176e44","ui_kits/workspace/Clients.jsx":"bac883add507","ui_kits/workspace/Dashboard.jsx":"aa3f349f7303","ui_kits/workspace/Schedule.jsx":"a18a00790ef6","ui_kits/workspace/app.jsx":"9d33d05eb11f","ui_kits/workspace/icons.jsx":"ccc07e81acae"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.UnclutterDeskDesignSystem_804b83 = window.UnclutterDeskDesignSystem_804b83 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const MARK = 'assets/unclutterdesk-mark.svg';

/**
 * The Unclutter Desk mark and lockup. `assetBase` is the relative path from
 * the consuming page to the design system root — the SVGs live in assets/.
 *
 * The "unclutter" wordmark is deliberately shared with the wider Unclutter
 * family; the DESK badge is what makes it this product. The badge is mint
 * (--desk-pine-200 on --desk-pine-900), never gold.
 */
function Logo({
  variant = 'lockup',
  size = 30,
  assetBase = '',
  onDark = true,
  style,
  ...rest
}) {
  const src = `${assetBase}${MARK}`;
  if (variant === 'mark') {
    return /*#__PURE__*/React.createElement("img", _extends({
      src: src,
      alt: "Unclutter Desk",
      width: size,
      height: size,
      style: {
        borderRadius: Math.round(size * 0.3),
        display: 'block',
        ...style
      }
    }, rest));
  }
  if (variant === 'poweredBy') {
    return /*#__PURE__*/React.createElement("div", _extends({
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        ...style
      }
    }, rest), /*#__PURE__*/React.createElement("img", {
      src: src,
      alt: "",
      width: 16,
      height: 16,
      style: {
        borderRadius: 5,
        opacity: 0.6,
        display: 'block'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--desk-text-subtle)'
      }
    }, "Booking powered by Unclutter Desk"));
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    width: size,
    height: size,
    style: {
      borderRadius: Math.round(size * 0.3),
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(size * 0.57),
      fontWeight: 600,
      letterSpacing: '-0.02em',
      color: onDark ? '#F8FAFC' : 'var(--desk-pine-800)'
    }
  }, "unclutter"), /*#__PURE__*/React.createElement("span", {
    style: {
      height: 18,
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0 8px',
      borderRadius: 999,
      background: 'var(--desk-pine-200)',
      color: 'var(--desk-pine-900)',
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '0.08em'
    }
  }, "DESK"));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/AvatarChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  tenant: {
    bg: 'var(--brand-fill)',
    fg: 'var(--brand-primary)'
  },
  secondary: {
    bg: 'var(--brand-secondary-tint)',
    fg: 'var(--brand-secondary)'
  },
  pine: {
    bg: 'var(--desk-pine-100)',
    fg: 'var(--desk-pine-700)'
  },
  slate: {
    bg: 'var(--desk-pine-700)',
    fg: '#FFFFFF'
  },
  muted: {
    bg: 'var(--desk-surface-muted)',
    fg: 'var(--desk-text-muted)'
  }
};

/**
 * Initials in a rounded square. There is no photography anywhere in Desk —
 * real implementations render an uploaded photo when present and fall back
 * to these initials.
 */
function AvatarChip({
  initials = '',
  size = 38,
  tone = 'tenant',
  radius,
  online = false,
  ring = false,
  style,
  ...rest
}) {
  const t = TONES[tone] ?? TONES.tenant;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: size,
      height: size,
      flex: 'none',
      borderRadius: radius ?? (size >= 70 ? 24 : size >= 44 ? 14 : 12),
      background: t.bg,
      color: t.fg,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 800,
      fontSize: Math.max(11, Math.round(size * 0.32)),
      letterSpacing: '-0.01em',
      boxShadow: ring ? '0 0 0 3px var(--brand-ring)' : undefined,
      ...style
    }
  }, rest), initials, online && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      bottom: -3,
      right: -3,
      width: 24,
      height: 24,
      borderRadius: 999,
      background: 'var(--desk-active-dot)',
      border: '3px solid #fff'
    }
  }));
}
Object.assign(__ds_scope, { AvatarChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/AvatarChip.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    bg: 'var(--desk-surface-muted)',
    fg: 'var(--desk-text-muted)'
  },
  pine: {
    bg: 'var(--desk-pine-100)',
    fg: 'var(--desk-pine-700)'
  },
  mint: {
    bg: 'var(--desk-pine-200)',
    fg: 'var(--desk-pine-900)'
  },
  tenant: {
    bg: 'var(--brand-fill)',
    fg: 'var(--brand-primary)'
  },
  tenantSolid: {
    bg: 'var(--brand-primary)',
    fg: 'var(--brand-on-primary)'
  },
  secondary: {
    bg: 'var(--brand-secondary-tint)',
    fg: 'var(--brand-secondary)'
  },
  dark: {
    bg: 'var(--desk-sidebar)',
    fg: '#fff'
  }
};

/**
 * Uppercase pill — WHITE-LABEL, SELECTED, MOST BOOKED, CLINICAL PSYCHOLOGY,
 * and the DESK badge in the sidebar lockup.
 */
function Badge({
  tone = 'neutral',
  height = 22,
  children,
  style,
  ...rest
}) {
  const t = TONES[tone] ?? TONES.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      height,
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0 10px',
      borderRadius: 999,
      background: t.bg,
      color: t.fg,
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const HEIGHTS = {
  sm: 32,
  md: 40,
  lg: 44,
  xl: 48,
  cta: 52
};
const RADII = {
  sm: 10,
  md: 14,
  lg: 14,
  xl: 14,
  cta: 16
};
const PAD = {
  sm: '0 12px',
  md: '0 16px',
  lg: '0 20px',
  xl: '0 22px',
  cta: '0 24px'
};
const FONT = {
  sm: 12.5,
  md: 13.5,
  lg: 14,
  xl: 14.5,
  cta: 15
};

/**
 * The Desk button. Tenant-colored variants read --brand-primary /
 * --brand-secondary, so an arbitrary tenant hue works with no second token —
 * hover is filter: brightness(1.08) on the element itself.
 */
function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  icon = null,
  iconAfter = null,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const base = {
    height: HEIGHTS[size],
    padding: PAD[size],
    borderRadius: RADII[size],
    fontSize: FONT[size],
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    border: '1px solid transparent',
    transition: 'background var(--dur-color) ease-out, box-shadow var(--dur-lift) ease-out, filter var(--dur-color) ease-out',
    width: fullWidth ? '100%' : undefined,
    transform: press && !disabled ? 'translateY(1px)' : undefined
  };
  const variants = {
    primary: {
      background: 'var(--brand-primary)',
      color: 'var(--brand-on-primary)',
      boxShadow: 'var(--desk-shadow-button)',
      filter: hover && !disabled ? 'brightness(1.08)' : undefined
    },
    secondary: {
      background: hover && !disabled ? 'var(--desk-surface-muted)' : 'var(--desk-card)',
      color: 'var(--desk-text)',
      borderColor: 'var(--desk-border-strong)',
      fontWeight: 600
    },
    ghost: {
      background: hover && !disabled ? 'var(--desk-surface-muted)' : 'transparent',
      color: 'var(--desk-text-muted)',
      fontWeight: 600
    },
    link: {
      background: hover && !disabled ? 'var(--desk-surface-muted)' : 'var(--desk-card)',
      color: 'var(--desk-pine-600)',
      borderColor: 'var(--desk-border-strong)',
      fontWeight: 600
    },
    danger: {
      background: 'var(--desk-danger)',
      color: '#FFFFFF',
      filter: hover && !disabled ? 'brightness(1.08)' : undefined
    },
    tenantSoft: {
      background: 'var(--brand-fill)',
      color: 'var(--brand-primary)',
      fontWeight: 700
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, rest), icon, children, iconAfter);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const PADS = {
  none: 0,
  sm: '18px 20px',
  md: '22px 24px',
  lg: '24px 26px'
};

/**
 * The workspace surface: white, 24px radius, hairline border, shadow-sm.
 * `hoverable` adds the standard lift — translateY(-1px) + shadow-hover.
 */
function Card({
  padding = 'lg',
  radius = 24,
  hoverable = false,
  raised = false,
  dark = false,
  style,
  children,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: hoverable ? () => setHover(true) : undefined,
    onMouseLeave: hoverable ? () => setHover(false) : undefined,
    style: {
      background: dark ? 'var(--desk-sidebar)' : 'var(--desk-card)',
      color: dark ? '#fff' : 'var(--desk-text)',
      border: dark ? 'none' : '1px solid var(--desk-border)',
      borderRadius: radius,
      padding: typeof padding === 'string' ? PADS[padding] ?? padding : padding,
      boxShadow: hover ? 'var(--desk-shadow-hover)' : raised ? 'var(--desk-shadow-lg)' : 'var(--desk-shadow-sm)',
      transform: hover ? 'translateY(-1px)' : undefined,
      transition: 'box-shadow var(--dur-lift) ease-out, transform var(--dur-lift) ease-out',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The 9px / 900 / 0.22em uppercase label that sits above nearly every card
 * and section. The system's most distinctive type signature.
 */
function Eyebrow({
  tone = 'subtle',
  children,
  style,
  ...rest
}) {
  const colors = {
    subtle: 'var(--desk-text-subtle)',
    muted: 'var(--desk-text-muted)',
    tenant: 'var(--brand-primary)',
    invert: 'rgba(255,255,255,.75)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontSize: 9,
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '0.22em',
      lineHeight: 1,
      color: colors[tone],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A square icon-only control. Used for copy buttons, calendar prev/next,
 * row overflow menus and the header notification bell.
 */
function IconButton({
  size = 40,
  variant = 'outline',
  radius,
  dot = false,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const variants = {
    outline: {
      background: hover ? 'var(--desk-surface-muted)' : 'var(--desk-card)',
      border: '1px solid var(--desk-border)',
      color: 'var(--desk-text)'
    },
    plain: {
      background: hover ? 'var(--desk-border)' : 'var(--desk-card)',
      border: '1px solid transparent',
      boxShadow: '0 1px 2px rgba(15,23,42,.08)',
      color: 'var(--desk-text)'
    },
    muted: {
      background: hover ? 'var(--desk-border)' : 'var(--desk-surface-muted)',
      border: '1px solid transparent',
      color: 'var(--desk-text-muted)'
    },
    tenant: {
      background: 'var(--brand-primary)',
      border: '1px solid transparent',
      color: 'var(--brand-on-primary)',
      filter: hover ? 'brightness(1.08)' : undefined
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      width: size,
      height: size,
      flex: 'none',
      borderRadius: radius ?? (size >= 40 ? 14 : 10),
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'background var(--dur-color) ease-out',
      ...variants[variant],
      ...style
    }
  }, rest), children, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 9,
      right: 9,
      width: 7,
      height: 7,
      borderRadius: 999,
      background: 'var(--desk-danger)',
      border: '1.5px solid #fff'
    }
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Status pill with leading dot. Success and pending were retuned when the
 * palette moved to pine: emerald sat too close to the new primary, and amber
 * was gold-family. Inactive, danger and info are unchanged.
 */
const STATUS = {
  active: {
    fg: 'var(--desk-active)',
    dot: 'var(--desk-active-dot)',
    bg: 'var(--desk-active-bg)',
    bd: 'var(--desk-active-border)'
  },
  pending: {
    fg: 'var(--desk-pending)',
    dot: 'var(--desk-pending-dot)',
    bg: 'var(--desk-pending-bg)',
    bd: 'var(--desk-pending-border)'
  },
  inactive: {
    fg: 'var(--desk-inactive)',
    dot: 'var(--desk-inactive)',
    bg: 'var(--desk-inactive-bg)',
    bd: 'var(--desk-inactive-border)'
  },
  danger: {
    fg: 'var(--desk-danger)',
    dot: 'var(--desk-danger)',
    bg: 'var(--desk-danger-bg)',
    bd: 'var(--desk-danger-border)'
  },
  info: {
    fg: 'var(--desk-info)',
    dot: 'var(--desk-info)',
    bg: 'var(--desk-info-bg)',
    bd: 'var(--desk-info-border)'
  }
};
function StatusPill({
  status = 'active',
  dot = true,
  height = 26,
  children,
  style,
  ...rest
}) {
  const s = STATUS[status] ?? STATUS.active;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      height,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '0 12px',
      borderRadius: 999,
      background: s.bg,
      border: `1px solid ${s.bd}`,
      color: s.fg,
      fontSize: 11.5,
      fontWeight: 700,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 999,
      background: s.dot,
      flex: 'none'
    }
  }), children);
}
Object.assign(__ds_scope, { STATUS, StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/data/BarChart.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The revenue bar row. Current month fills with the tenant primary; prior
 * months use --brand-bar. Heights transition 300ms ease-out.
 */
function BarChart({
  data = [],
  height = 96,
  gap = 10,
  showValues = false,
  formatValue = v => v,
  style,
  ...rest
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap,
      ...style
    }
  }, rest), data.map((d, i) => {
    const current = d.current ?? i === data.length - 1;
    return /*#__PURE__*/React.createElement("div", {
      key: d.label + i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        minWidth: 0
      }
    }, showValues && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--desk-text-muted)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, formatValue(d.value)), /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        height: Math.max(6, Math.round(d.value / max * height)),
        borderRadius: showValues ? '10px 10px 4px 4px' : '8px 8px 3px 3px',
        background: current ? 'var(--brand-primary)' : 'var(--brand-bar)',
        transition: 'height var(--dur-bar) ease-out'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--desk-text-subtle)'
      }
    }, d.label));
  }));
}
Object.assign(__ds_scope, { BarChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BarChart.jsx", error: String((e && e.message) || e) }); }

// components/data/ProgressRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  tenant: 'var(--brand-primary)',
  secondary: 'var(--brand-secondary)',
  muted: 'var(--desk-text-subtle)'
};

/**
 * Session-mix / referral-source row: name, count, right-aligned percentage,
 * and a 10px track with a filled bar.
 */
function ProgressRow({
  label,
  meta,
  percent = 0,
  tone = 'tenant',
  track = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--desk-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, label), meta && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-subtle)'
    }
  }, meta), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 13.5,
      fontWeight: 800,
      color: 'var(--desk-text)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, percent, "%")), track && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 10,
      borderRadius: 999,
      background: 'var(--desk-surface-muted)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.min(100, Math.max(0, percent))}%`,
      height: '100%',
      borderRadius: 999,
      background: TONES[tone] ?? TONES.tenant,
      transition: 'width var(--dur-bar) ease-out'
    }
  })));
}
Object.assign(__ds_scope, { ProgressRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ProgressRow.jsx", error: String((e && e.message) || e) }); }

// components/data/StatTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** KPI tile: eyebrow over a tabular value. 20px radius, 16px 18px padding. */
function StatTile({
  label,
  value,
  delta,
  deltaTone = 'active',
  compact = false,
  style,
  ...rest
}) {
  const tones = {
    active: {
      bg: 'var(--desk-active-bg)',
      bd: 'var(--desk-active-border)',
      fg: 'var(--desk-active)'
    },
    pending: {
      bg: 'var(--desk-pending-bg)',
      bd: 'var(--desk-pending-border)',
      fg: 'var(--desk-pending)'
    }
  };
  const t = tones[deltaTone] ?? tones.active;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      minWidth: compact ? 96 : undefined,
      padding: compact ? '12px 14px' : '16px 18px',
      borderRadius: compact ? 16 : 20,
      background: compact ? 'var(--desk-surface)' : 'var(--desk-card)',
      border: '1px solid var(--desk-border)',
      boxShadow: compact ? 'none' : 'var(--desk-shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: compact ? 4 : 8,
      ...style
    }
  }, rest), !compact && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '0.2em',
      color: 'var(--desk-text-subtle)',
      lineHeight: 1
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: compact ? 22 : 26,
      fontWeight: 800,
      letterSpacing: compact ? '-0.03em' : '-0.035em',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--desk-text)'
    }
  }, value), delta && /*#__PURE__*/React.createElement("span", {
    style: {
      height: 22,
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0 9px',
      borderRadius: 999,
      background: t.bg,
      border: `1px solid ${t.bd}`,
      color: t.fg,
      fontSize: 11.5,
      fontWeight: 700
    }
  }, delta)), compact && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--desk-text-muted)'
    }
  }, label));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/forms/ColorField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A tenant brand-color field: native swatch with its chrome removed, a role
 * label, and the uppercase mono hex. Fires on both `input` and `change` so
 * dragging in the picker updates the preview continuously.
 */
function ColorField({
  label = 'Primary',
  value = '#24614F',
  onChange,
  style,
  ...rest
}) {
  const emit = e => onChange && onChange(e.target.value);
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 12px',
      borderRadius: 16,
      background: 'var(--desk-surface)',
      border: '1px solid var(--desk-border)',
      cursor: 'pointer',
      minWidth: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: value,
    onInput: emit,
    onChange: emit,
    style: {
      width: 36,
      height: 36,
      flex: 'none',
      padding: 0,
      border: 'none',
      borderRadius: 10,
      background: 'none',
      WebkitAppearance: 'none',
      appearance: 'none',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--desk-text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      fontWeight: 600,
      color: 'var(--desk-text)'
    }
  }, String(value).toUpperCase())), /*#__PURE__*/React.createElement("style", null, `
        input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type=color]::-webkit-color-swatch { border: none; border-radius: 10px; }
      `));
}

/**
 * The five preset pairs from Brand Settings, as split swatches.
 * Values are fixed; only the first one's label changed with the rename.
 */
const BRAND_PRESETS = [{
  name: 'Deep navy',
  primary: '#0F3A53',
  secondary: '#E3B341'
}, {
  name: 'Signal blue',
  primary: '#007BFF',
  secondary: '#6F42C1'
}, {
  name: 'Calm teal',
  primary: '#0E7490',
  secondary: '#F59E0B'
}, {
  name: 'Deep violet',
  primary: '#7C3AED',
  secondary: '#EC4899'
}, {
  name: 'Forest',
  primary: '#15803D',
  secondary: '#B45309'
}];
function PresetSwatches({
  value,
  onPick,
  size = 30,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      ...style
    }
  }, BRAND_PRESETS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.name,
    type: "button",
    title: p.name,
    "aria-label": p.name,
    onClick: () => onPick && onPick(p),
    style: {
      width: size,
      height: size,
      padding: 0,
      display: 'flex',
      overflow: 'hidden',
      borderRadius: 10,
      cursor: 'pointer',
      border: `2px solid ${value === p.primary ? 'var(--desk-text)' : 'var(--desk-border)'}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      background: p.primary
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      background: p.secondary
    }
  }))));
}
Object.assign(__ds_scope, { ColorField, BRAND_PRESETS, PresetSwatches });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/ColorField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Desk text field. 46px in the booking portal, 44px in the workspace.
 * Focus switches background #F8FAFC → #FFFFFF and border → #94A3B8,
 * plus the tenant focus ring.
 */
function Input({
  label,
  optionalLabel,
  height = 46,
  icon = null,
  trailing = null,
  readOnly = false,
  muted = false,
  mono = false,
  style,
  wrapperStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
      ...wrapperStyle
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: 'var(--desk-text-body)'
    }
  }, label, optionalLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: 'var(--desk-text-subtle)'
    }
  }, " ", optionalLabel)), /*#__PURE__*/React.createElement("span", {
    style: {
      height,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: trailing ? '0 6px 0 14px' : '0 14px',
      borderRadius: 14,
      background: muted ? 'var(--desk-surface-muted)' : focus ? '#FFFFFF' : 'var(--desk-surface)',
      border: `1px solid ${focus ? 'var(--desk-border-strong)' : 'var(--desk-border)'}`,
      boxShadow: focus ? 'var(--desk-focus-ring)' : undefined,
      transition: 'background var(--dur-color) ease-out, border-color var(--dur-color) ease-out'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--desk-text-subtle)',
      display: 'flex',
      flex: 'none'
    }
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    readOnly: readOnly,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontSize: mono ? 12.5 : 14,
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-primary)',
      fontWeight: mono || readOnly ? 500 : 400,
      color: 'var(--desk-text)',
      ...style
    }
  }, rest)), trailing));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedControl.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single-select control on a muted track. Week/Day/Month, Online/In-person,
 * 30 days/90 days/12 months.
 */
function SegmentedControl({
  options = [],
  value,
  onChange,
  height = 40,
  style,
  ...rest
}) {
  const active = value ?? options[0];
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      height,
      display: 'inline-flex',
      alignItems: 'stretch',
      gap: 2,
      padding: 4,
      borderRadius: 14,
      background: 'var(--desk-surface-muted)',
      ...style
    }
  }, rest), options.map(opt => {
    const on = opt === active;
    return /*#__PURE__*/React.createElement("button", {
      key: opt,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(opt),
      style: {
        padding: '0 14px',
        borderRadius: 11,
        border: 'none',
        cursor: 'pointer',
        background: on ? '#FFFFFF' : 'transparent',
        color: on ? 'var(--desk-text)' : 'var(--desk-text-muted)',
        boxShadow: on ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
        fontSize: 13,
        fontWeight: on ? 700 : 600,
        fontFamily: 'var(--font-primary)',
        transition: 'background var(--dur-color) ease-out, color var(--dur-color) ease-out'
      }
    }, opt);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Multi-line field. Non-resizable by design; 1.6 line-height. */
function Textarea({
  label,
  optionalLabel,
  rows = 3,
  style,
  wrapperStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
      ...wrapperStyle
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: 'var(--desk-text-body)'
    }
  }, label, optionalLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: 'var(--desk-text-subtle)'
    }
  }, " ", optionalLabel)), /*#__PURE__*/React.createElement("textarea", _extends({
    rows: rows,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      resize: 'none',
      padding: '12px 14px',
      borderRadius: 14,
      background: focus ? '#FFFFFF' : 'var(--desk-surface)',
      border: `1px solid ${focus ? 'var(--desk-border-strong)' : 'var(--desk-border)'}`,
      boxShadow: focus ? 'var(--desk-focus-ring)' : undefined,
      outline: 'none',
      fontSize: 14,
      fontFamily: 'var(--font-primary)',
      color: 'var(--desk-text)',
      lineHeight: 1.6,
      transition: 'background var(--dur-color) ease-out, border-color var(--dur-color) ease-out',
      ...style
    }
  }, rest)));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/forms/Toggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The practice-status switch. Track is success green when on, --desk-border-strong
 * when off; the knob translates 200ms ease-out.
 */
function Toggle({
  checked = false,
  onChange,
  width = 60,
  disabled = false,
  style,
  ...rest
}) {
  const height = Math.round(width * 34 / 60);
  const knob = height - 6;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": checked,
    disabled: disabled,
    onClick: () => onChange && onChange(!checked),
    style: {
      width,
      height,
      flex: 'none',
      padding: 3,
      borderRadius: 999,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      background: checked ? 'var(--desk-active-dot)' : 'var(--desk-border-strong)',
      transition: 'background var(--dur-toggle) ease-out',
      display: 'flex',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: knob,
      height: knob,
      borderRadius: 999,
      background: '#fff',
      boxShadow: '0 2px 6px rgba(15,23,42,.22)',
      transform: checked ? `translateX(${width - knob - 6}px)` : 'translateX(0)',
      transition: 'transform var(--dur-toggle) ease-out'
    }
  }));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/navigation/AppHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** 80px white app header: eyebrow + screen title left, action cluster right. */
function AppHeader({
  eyebrow,
  title,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      height: 80,
      flex: 'none',
      background: 'var(--desk-card)',
      borderBottom: '1px solid var(--desk-border)',
      padding: '0 26px',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '0.22em',
      color: 'var(--desk-text-subtle)',
      lineHeight: 1
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: 'var(--desk-text)'
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, children));
}
Object.assign(__ds_scope, { AppHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/AppHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BottomNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The mobile app's frosted bottom navigation. Active tab is a solid slate
 * pill with white icon and label — no icon-only treatment.
 */
function BottomNav({
  items = [],
  active,
  onSelect,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      height: 92,
      flex: 'none',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 14px 0',
      background: 'var(--desk-glass-bg)',
      backdropFilter: 'var(--desk-glass-blur)',
      WebkitBackdropFilter: 'var(--desk-glass-blur)',
      borderTop: '1px solid var(--desk-glass-border)',
      borderRadius: '24px 24px 0 0',
      ...style
    }
  }, rest), items.map(it => {
    const on = (it.key ?? it.label) === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.key ?? it.label,
      type: "button",
      onClick: () => onSelect && onSelect(it.key ?? it.label),
      style: {
        height: 52,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '0 14px',
        borderRadius: 16,
        border: 'none',
        cursor: 'pointer',
        background: on ? 'var(--desk-sidebar)' : 'transparent',
        color: on ? '#FFFFFF' : 'var(--desk-text-subtle)',
        fontFamily: 'var(--font-primary)',
        transition: 'background var(--dur-color) ease-out, color var(--dur-color) ease-out'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex'
      }
    }, it.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700
      }
    }, it.label));
  }));
}
Object.assign(__ds_scope, { BottomNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BottomNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sidebar navigation item. Active state is the pine gradient with the 3px
 * edge marker and pine icon stroke — this is where the old gold accent lived.
 * Only one item is ever active.
 */
function NavItem({
  label,
  icon,
  active = false,
  count,
  countTone = 'neutral',
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const countTones = {
    neutral: {
      bg: 'rgba(255,255,255,.1)',
      fg: '#CBD5E1'
    },
    pine: {
      bg: 'var(--desk-pine-400)',
      fg: 'var(--desk-sidebar)'
    },
    danger: {
      bg: 'var(--desk-danger)',
      fg: '#FFFFFF'
    }
  };
  const ct = countTones[countTone] ?? countTones.neutral;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      height: 44,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '0 12px',
      borderRadius: 14,
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: 13.5,
      fontWeight: 600,
      fontFamily: 'var(--font-primary)',
      color: active ? '#FFFFFF' : hover ? '#E2E8F0' : 'var(--desk-text-subtle)',
      background: active ? 'var(--desk-nav-active-bg)' : hover ? 'var(--desk-sidebar-hover)' : 'transparent',
      boxShadow: active ? 'var(--desk-shadow-nav-active)' : 'none',
      transition: 'background var(--dur-color) ease-out, color var(--dur-color) ease-out',
      ...style
    }
  }, rest), active && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 0,
      top: 12,
      width: 3,
      height: 20,
      borderRadius: '0 3px 3px 0',
      background: 'var(--desk-pine-400)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flex: 'none',
      color: active ? 'var(--desk-pine-400)' : 'currentColor'
    }
  }, icon), label, count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      height: 20,
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      borderRadius: 999,
      background: ct.bg,
      color: ct.fg,
      fontSize: 10.5,
      fontWeight: 800
    }
  }, count));
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The 248px workspace shell sidebar. Slate in every tenancy — tenant color
 * enters only through the active item's gradient, never the background.
 */
function Sidebar({
  items = [],
  active,
  onSelect,
  user,
  assetBase = '',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      width: 248,
      flex: 'none',
      background: 'var(--desk-sidebar)',
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 8px 22px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    variant: "lockup",
    size: 30,
    assetBase: assetBase
  })), items.map(it => /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    key: it.key ?? it.label,
    label: it.label,
    icon: it.icon,
    count: it.count,
    countTone: it.countTone,
    active: (it.key ?? it.label) === active,
    onClick: () => onSelect && onSelect(it.key ?? it.label)
  })), user && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      borderTop: '1px solid rgba(255,255,255,.07)',
      padding: '14px 10px 2px',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AvatarChip, {
    initials: user.initials,
    size: 32,
    tone: "slate",
    radius: 10
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: '#E2E8F0'
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--desk-text-muted)'
    }
  }, user.role))));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/_shared/load-components.js
try { (() => {
/* Standalone loader for the UI kits.
 *
 * Once this project is compiled as a design system, `_ds_bundle.js` provides
 * the component namespace and this file is a no-op fallback. Until then — and
 * when the kits are opened straight off disk — it fetches the component
 * sources, strips their ESM syntax (React is already global here), and puts
 * every primitive on `window.DESK`.
 *
 * Prototype plumbing only. Not part of the design system's public surface.
 */
(function () {
  const FILES = ['core/AvatarChip', 'core/Badge', 'core/Button', 'core/Card', 'core/Eyebrow', 'core/IconButton', 'core/StatusPill', 'forms/Input', 'forms/Textarea', 'forms/SegmentedControl', 'forms/Toggle', 'forms/ColorField', 'data/StatTile', 'data/BarChart', 'data/ProgressRow', 'brand/Logo', 'navigation/NavItem', 'navigation/Sidebar', 'navigation/AppHeader', 'navigation/BottomNav'];
  const NAMES = ['AvatarChip', 'Badge', 'Button', 'Card', 'Eyebrow', 'IconButton', 'StatusPill', 'STATUS', 'Input', 'Textarea', 'SegmentedControl', 'Toggle', 'ColorField', 'BRAND_PRESETS', 'PresetSwatches', 'StatTile', 'BarChart', 'ProgressRow', 'Logo', 'NavItem', 'Sidebar', 'AppHeader', 'BottomNav'];

  /* Iterate keys defensively — Object.values(window) touches cross-origin
     frames and throws a SecurityError when a page is previewed in an iframe. */
  function findBundleNamespace() {
    for (const k of Object.getOwnPropertyNames(window)) {
      try {
        const v = window[k];
        if (v && typeof v === 'object' && v !== window.DESK && v.Sidebar && v.BarChart && v.StatusPill) return v;
      } catch (e) {/* cross-origin frame */}
    }
    return null;
  }
  function tryBundle(base) {
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = base + '_ds_bundle.js';
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }
  window.loadDeskComponents = async function (base) {
    if (!findBundleNamespace()) await tryBundle(base);
    const bundled = findBundleNamespace();
    if (bundled) {
      window.DESK = bundled;
      return bundled;
    }
    const sources = await Promise.all(FILES.map(f => fetch(base + 'components/' + f + '.jsx').then(r => r.text())));
    const ns = {};
    window.__DESK_NS = ns;

    /* Each file is wrapped in its own IIFE so module-private constants
       (several files declare a local TONES map) don't collide, and its
       sibling imports are re-bound from the namespace built so far. */
    const chunks = sources.map(src => {
      const declared = [...src.matchAll(/^export\s+(?:function|const)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
      const needed = NAMES.filter(n => !declared.includes(n));
      const body = src.replace(/^\s*import[^;]+;\s*$/gm, '').replace(/^export\s+/gm, '');
      return ['(function(){', needed.length ? 'const {' + needed.join(', ') + '} = window.__DESK_NS;' : '', body, 'Object.assign(window.__DESK_NS, {' + declared.join(', ') + '});', '})();'].join('\n');
    });
    for (const chunk of chunks) {
      (0, eval)(Babel.transform(chunk, {
        presets: [['react', {
          runtime: 'classic'
        }]]
      }).code);
    }
    window.DESK = ns;
    return ns;
  };

  /* Load kit screen files the same way. Babel's own script-tag transformer
     doesn't reliably execute external sources here, and code it evaluates
     isn't global — so each screen file publishes what it defines on window. */
  window.loadDeskScreens = async function (paths) {
    for (const p of paths) {
      const src = await fetch(p).then(r => r.text());
      (0, eval)(Babel.transform(src, {
        presets: [['react', {
          runtime: 'classic'
        }]]
      }).code);
    }
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/_shared/load-components.js", error: String((e && e.message) || e) }); }

// ui_kits/booking/Booking.jsx
try { (() => {
/* White-label client booking portal (public) + the confirmation screen.
   Authored at 1180px. Everything branded reads the tenant slots; the only
   Desk branding is the "Booking powered by Unclutter Desk" footer line. */

const SERVICES = [{
  id: 'individual',
  title: '50-minute Individual Session',
  detail: 'One-to-one therapy · online or in person',
  price: 30000,
  tag: 'Most booked',
  label: 'Individual Therapy',
  mins: 50
}, {
  id: 'couples',
  title: '80-minute Couples Session',
  detail: 'For partners attending together',
  price: 52000,
  tag: '80 min',
  label: 'Couples Therapy',
  mins: 80
}];
const SLOTS = ['9:00 AM', '11:30 AM', '2:00 PM', '4:30 PM'];
const OPEN_DAYS = [10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 31];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_LABEL = 'August 2026';
const LONG_DATE = d => {
  const names = {
    10: 'Monday',
    11: 'Tuesday',
    12: 'Wednesday',
    13: 'Thursday',
    14: 'Friday',
    17: 'Monday',
    18: 'Tuesday',
    19: 'Wednesday',
    20: 'Thursday',
    21: 'Friday',
    24: 'Monday',
    25: 'Tuesday',
    26: 'Wednesday',
    27: 'Thursday',
    28: 'Friday',
    31: 'Monday'
  };
  return `${names[d] || ''}, ${d} August 2026`;
};
const naira = n => '₦' + n.toLocaleString('en-NG');
function StepHeading({
  n,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 999,
      background: 'var(--brand-primary)',
      color: 'var(--brand-on-primary)',
      fontSize: 11,
      fontWeight: 800,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none'
    }
  }, n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, children));
}
function BrandHeader() {
  const {
    Badge,
    Logo
  } = window.DESK;
  return /*#__PURE__*/React.createElement("header", {
    style: {
      padding: '30px 40px 26px',
      background: 'linear-gradient(120deg, var(--brand-tint), var(--brand-secondary-tint))',
      borderBottom: '1px solid var(--brand-ring)',
      display: 'flex',
      gap: 22,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 82,
      height: 82,
      flex: 'none',
      borderRadius: 26,
      background: '#fff',
      boxShadow: '0 8px 24px rgba(15,23,42,.10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 26,
      fontWeight: 800,
      color: 'var(--brand-primary)'
    }
  }, "JS"), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'var(--brand-primary)'
    }
  }, "Dr. Jane Smith Therapy"), /*#__PURE__*/React.createElement(Badge, {
    tone: "secondary",
    height: 20
  }, "Clinical psychology")), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: '-0.035em',
      margin: '10px 0 0'
    }
  }, "Book a session with Dr. Jane Smith"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginTop: 12,
      fontSize: 13,
      color: 'var(--desk-text-body)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.star,
    size: 14,
    fill: "var(--desk-pine-500)",
    style: {
      color: 'var(--desk-pine-500)'
    }
  }), /*#__PURE__*/React.createElement("strong", null, "4.9"), " \xB7 214 reviews"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.pin,
    size: 14
  }), " Lagos, Nigeria \xB7 Online & in-person"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.check,
    size: 14
  }), " Licensed \xB7 12 years practising"))));
}
function ServiceCard({
  s,
  selected,
  onSelect
}) {
  const {
    Badge
  } = window.DESK;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onSelect,
    style: {
      textAlign: 'left',
      cursor: 'pointer',
      padding: 18,
      borderRadius: 20,
      background: '#fff',
      border: `2px solid ${selected ? 'var(--brand-primary)' : 'var(--desk-border)'}`,
      boxShadow: selected ? '0 10px 28px var(--brand-ring)' : 'none',
      transition: 'border-color var(--dur-color) ease-out, box-shadow var(--dur-lift) ease-out',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, s.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--desk-text-muted)',
      marginTop: 4
    }
  }, s.detail)), /*#__PURE__*/React.createElement(Badge, {
    tone: selected ? 'tenantSolid' : 'neutral',
    style: {
      marginLeft: 'auto',
      flex: 'none'
    }
  }, selected ? 'Selected' : s.tag)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: '-0.03em'
    }
  }, naira(s.price)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-subtle)'
    }
  }, "per session")));
}
function Calendar({
  date,
  setDate
}) {
  const {
    IconButton
  } = window.DESK;
  /* August 2026 starts on a Saturday; Monday-first grid → 5 leading blanks. */
  const cells = [null, null, null, null, null, ...Array.from({
    length: 31
  }, (_, i) => i + 1)];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 30,
    variant: "muted",
    "aria-label": "Previous month"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.chevronLeft,
    size: 15
  })), /*#__PURE__*/React.createElement(IconButton, {
    size: 30,
    variant: "muted",
    "aria-label": "Next month"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.chevronRight,
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14.5,
      fontWeight: 700
    }
  }, MONTH_LABEL), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 11.5,
      color: 'var(--desk-text-subtle)'
    }
  }, "WAT (GMT+1)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: 6,
      marginTop: 14
    }
  }, DOW.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      textAlign: 'center',
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.1em',
      color: 'var(--desk-text-subtle)'
    }
  }, d)), cells.map((d, i) => {
    if (d == null) return /*#__PURE__*/React.createElement("div", {
      key: i
    });
    const open = OPEN_DAYS.includes(d);
    const on = d === date;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      disabled: !open,
      onClick: () => open && setDate(d),
      style: {
        position: 'relative',
        height: 38,
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: open ? 'pointer' : 'default',
        background: on ? 'var(--brand-primary)' : open ? 'var(--desk-surface)' : 'transparent',
        border: `1px solid ${on ? 'var(--brand-primary)' : open ? 'var(--desk-border)' : 'transparent'}`,
        color: on ? 'var(--brand-on-primary)' : open ? 'var(--desk-text)' : 'var(--desk-border-strong)',
        transition: 'background var(--dur-color) ease-out'
      }
    }, d, open && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        bottom: 5,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 4,
        height: 4,
        borderRadius: 999,
        background: on ? 'rgba(255,255,255,.65)' : 'var(--brand-dot)'
      }
    }));
  })));
}
function BookingPortal({
  state,
  set,
  onConfirm
}) {
  const {
    Card,
    Eyebrow,
    Input,
    Textarea,
    SegmentedControl,
    Button,
    Logo
  } = window.DESK;
  const service = SERVICES.find(s => s.id === state.service);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1180,
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement(BrandHeader, null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '30px 40px 40px',
      background: 'var(--desk-surface-alt)',
      display: 'grid',
      gridTemplateColumns: '1fr 348px',
      gap: 28,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 26,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StepHeading, {
    n: "1"
  }, "Choose a service"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, SERVICES.map(s => /*#__PURE__*/React.createElement(ServiceCard, {
    key: s.id,
    s: s,
    selected: state.service === s.id,
    onSelect: () => set({
      service: s.id
    })
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StepHeading, {
    n: "2"
  }, "Pick a date & time"), /*#__PURE__*/React.createElement(Card, {
    radius: 22,
    padding: 20,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 216px',
      gap: 20,
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement(Calendar, {
    date: state.date,
    setDate: d => set({
      date: d
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderLeft: '1px solid var(--desk-border)',
      paddingLeft: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Available times"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, LONG_DATE(state.date)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 2
    }
  }, SLOTS.map(t => {
    const on = t === state.slot;
    return /*#__PURE__*/React.createElement("button", {
      key: t,
      type: "button",
      onClick: () => set({
        slot: t
      }),
      style: {
        height: 42,
        borderRadius: 999,
        fontSize: 13.5,
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        background: on ? 'var(--brand-primary)' : '#fff',
        border: `1.5px solid ${on ? 'var(--brand-primary)' : 'var(--desk-border)'}`,
        color: on ? 'var(--brand-on-primary)' : 'var(--desk-text)',
        transition: 'background var(--dur-color) ease-out'
      }
    }, t);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--desk-text-subtle)',
      lineHeight: 1.5,
      marginTop: 2
    }
  }, "Times shown in your local timezone. Sessions run ", service.mins, " minutes.")))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StepHeading, {
    n: "3"
  }, "Your details"), /*#__PURE__*/React.createElement(Card, {
    radius: 22,
    padding: 22,
    style: {
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Full name",
    placeholder: "Adaeze Okonkwo"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Email address",
    placeholder: "adaeze@email.com"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Phone number",
    placeholder: "+234 801 234 5678"
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: 'var(--desk-text-body)'
    }
  }, "Session format"), /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ['Online', 'In-person'],
    value: state.format,
    onChange: v => set({
      format: v
    }),
    height: 46,
    style: {
      display: 'flex'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, /*#__PURE__*/React.createElement(Textarea, {
    label: "Share concerns",
    optionalLabel: "(optional)",
    rows: 3,
    placeholder: "Anything you'd like Dr. Smith to know before your first session."
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 14,
      fontSize: 11.5,
      color: 'var(--desk-text-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.shield,
    size: 14,
    style: {
      color: 'var(--desk-active)'
    }
  }), "Encrypted and confidential. Shared only with Dr. Smith.")))), /*#__PURE__*/React.createElement("aside", {
    style: {
      position: 'sticky',
      top: 24,
      background: '#fff',
      borderRadius: 22,
      overflow: 'hidden',
      border: '1px solid var(--desk-border)',
      boxShadow: 'var(--desk-shadow-lg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 22px',
      background: 'var(--brand-primary)'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "invert"
  }, "Session summary"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: 'var(--brand-on-primary)',
      marginTop: 8
    }
  }, service.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, [['Service', service.title], ['Date', LONG_DATE(state.date)], ['Time', `${state.slot} WAT · ${service.mins} min`], ['Therapist', 'Dr. Jane Smith'], ['Format', state.format]].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 78,
      flex: 'none',
      fontSize: 12.5,
      color: 'var(--desk-text-subtle)'
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      textAlign: 'right',
      fontSize: 13.5,
      fontWeight: 600
    }
  }, v))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--desk-border)',
      margin: '4px 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--desk-text-body)'
    }
  }, "Total"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: '-0.035em'
    }
  }, naira(service.price))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--desk-text-subtle)',
      textAlign: 'right',
      marginTop: -4
    }
  }, "Paid securely at booking"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "cta",
    fullWidth: true,
    onClick: onConfirm,
    style: {
      marginTop: 6,
      boxShadow: 'var(--desk-shadow-tenant)'
    },
    iconAfter: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.arrowRight,
      size: 17
    })
  }, "Confirm & Book Session"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      justifyContent: 'center',
      fontSize: 11.5,
      color: 'var(--desk-text-subtle)',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.lock,
    size: 13
  }), " Free cancellation up to 24 hours before")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 22px',
      background: 'var(--desk-surface)',
      borderTop: '1px solid var(--desk-border)'
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    variant: "poweredBy",
    assetBase: "../../"
  })))));
}
function BookingConfirmed({
  state,
  onReschedule
}) {
  const {
    Button,
    AvatarChip,
    StatusPill,
    Logo
  } = window.DESK;
  const service = SERVICES.find(s => s.id === state.service);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1180,
      padding: '52px 40px 56px',
      background: 'linear-gradient(180deg, var(--brand-tint), var(--desk-surface-alt) 240px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 72,
      borderRadius: 26,
      background: 'var(--brand-primary)',
      boxShadow: '0 14px 34px var(--brand-ring)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "34",
    height: "34",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 12.5 9.5 18 20 6"
  }))), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      letterSpacing: '-0.035em',
      margin: 0,
      textAlign: 'center'
    }
  }, "Your session is booked"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: 'var(--desk-text-body)',
      maxWidth: 460,
      textAlign: 'center',
      textWrap: 'pretty',
      lineHeight: 1.6,
      margin: 0
    }
  }, "A confirmation has been sent to your email, along with a secure telehealth link you can open five minutes before the session."), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 560,
      background: '#fff',
      borderRadius: 24,
      overflow: 'hidden',
      boxShadow: 'var(--desk-shadow-lg)',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '20px 24px',
      borderBottom: '1px solid var(--desk-border)'
    }
  }, /*#__PURE__*/React.createElement(AvatarChip, {
    initials: "JS",
    size: 46
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      fontWeight: 700
    }
  }, "Dr. Jane Smith"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--desk-text-muted)'
    }
  }, "Clinical Psychology \xB7 ", service.title)), /*#__PURE__*/React.createElement(StatusPill, {
    status: "active",
    style: {
      marginLeft: 'auto'
    }
  }, "Confirmed")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, [['Booking ref', /*#__PURE__*/React.createElement("span", {
    className: "d-mono"
  }, "UDK-4C81-2026")], ['Date', LONG_DATE(state.date)], ['Time', `${state.slot} WAT · ${service.mins} min`], ['Therapist', 'Dr. Jane Smith'], ['Format', state.format], ['Paid', `${naira(service.price)} · Card ending 4412`]].map(([k, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 100,
      flex: 'none',
      fontSize: 12.5,
      color: 'var(--desk-text-subtle)'
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      textAlign: 'right',
      fontSize: 13.5,
      fontWeight: 600
    }
  }, v))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "xl",
    style: {
      flex: 1
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.calendar,
      size: 15
    })
  }, "Add to calendar"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "xl",
    style: {
      flex: 1
    },
    onClick: onReschedule
  }, "Reschedule"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 24px',
      background: 'var(--desk-surface)',
      borderTop: '1px solid var(--desk-border)'
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    variant: "poweredBy",
    assetBase: "../../"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--desk-text-subtle)'
    }
  }, "Free cancellation up to 24 hours before your session."));
}
window.BookingPortal = BookingPortal;
window.BookingConfirmed = BookingConfirmed;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/booking/Booking.jsx", error: String((e && e.message) || e) }); }

// ui_kits/booking/app.jsx
try { (() => {
/* Public booking page — presented inside browser chrome purely to communicate
   that this is a page on the therapist's own domain. Do not build the chrome. */

const params = new URLSearchParams(location.search);
const embed = params.get('embed') === '1';
if (embed) document.body.dataset.embed = '1';
function BookingApp() {
  const [screen, setScreen] = React.useState(params.get('screen') === 'confirmed' ? 'confirmed' : 'booking');
  const [state, setState] = React.useState({
    service: 'individual',
    date: 14,
    slot: '11:30 AM',
    format: 'Online'
  });
  const set = patch => setState(s => ({
    ...s,
    ...patch
  }));
  const primary = params.get('primary') || '#24614F';
  const secondary = params.get('secondary') || '#8A5A3C';
  return /*#__PURE__*/React.createElement("div", {
    className: "desk-tenant",
    style: {
      '--brand-primary': primary,
      '--brand-secondary': secondary
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1180,
      margin: embed ? 0 : '28px auto',
      background: '#fff',
      borderRadius: embed ? 0 : 18,
      overflow: 'hidden',
      boxShadow: embed ? 'none' : 'var(--desk-shadow-frame)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "chrome"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: '#FF5F57'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: '#FEBC2E'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: '#28C840'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      background: 'var(--desk-surface-muted)',
      borderRadius: 999,
      padding: '5px 16px',
      fontSize: 12,
      color: 'var(--desk-text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.lock,
    size: 12,
    style: {
      color: 'var(--desk-active)'
    }
  }), "booking.drsmiththerapy.com")), screen === 'booking' ? /*#__PURE__*/React.createElement(BookingPortal, {
    state: state,
    set: set,
    onConfirm: () => setScreen('confirmed')
  }) : /*#__PURE__*/React.createElement(BookingConfirmed, {
    state: state,
    onReschedule: () => setScreen('booking')
  })));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(BookingApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/booking/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/Screens.jsx
try { (() => {
/* Mobile companion app — five screens at 390 × 844.
   Frames are drawn at radius 46px for presentation only; build to the device viewport. */

const M = {
  frame: {
    width: 390,
    height: 844,
    flex: 'none',
    borderRadius: 46,
    overflow: 'hidden',
    background: 'var(--desk-surface)',
    boxShadow: 'var(--desk-shadow-phone)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  status: {
    height: 52,
    flex: 'none',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '0 26px 6px',
    fontSize: 13,
    fontWeight: 700
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '0 20px 16px'
  }
};
function StatusBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: M.status
  }, "9:41");
}
function MobileToday() {
  const {
    Card,
    AvatarChip,
    IconButton,
    Button,
    StatusPill
  } = window.DESK;
  const bars = [238, 262, 251, 305, 288, 331, 318, 372, 355, 401, 380, 450];
  const max = 450;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: M.body
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '4px 0 18px'
    }
  }, /*#__PURE__*/React.createElement(AvatarChip, {
    initials: "JS",
    size: 44,
    tone: "pine"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.14em',
      color: 'var(--desk-text-subtle)'
    }
  }, "THURSDAY, 7 AUGUST"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 800,
      letterSpacing: '-0.03em',
      marginTop: 4
    }
  }, "Good morning")), /*#__PURE__*/React.createElement(IconButton, {
    size: 40,
    dot: true,
    "aria-label": "Notifications",
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.bell,
    size: 17
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--desk-sidebar)',
      borderRadius: 32,
      padding: '22px 24px',
      boxShadow: '0 18px 40px rgba(15,23,42,.28)',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 900,
      letterSpacing: '0.22em',
      color: 'var(--desk-text-muted)'
    }
  }, "REVENUE THIS MONTH"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      height: 22,
      display: 'flex',
      alignItems: 'center',
      padding: '0 9px',
      borderRadius: 999,
      background: 'rgba(16,185,129,.16)',
      color: '#34D399',
      fontSize: 11.5,
      fontWeight: 700
    }
  }, "+18.2%")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      fontWeight: 800,
      letterSpacing: '-0.04em',
      marginTop: 10
    }
  }, "\u20A6450,000"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 5,
      height: 44,
      marginTop: 16
    }
  }, bars.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: v / max * 44,
      borderRadius: '4px 4px 2px 2px',
      background: i === bars.length - 1 ? '#fff' : 'rgba(255,255,255,.22)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      marginTop: 16,
      paddingTop: 14,
      borderTop: '1px solid rgba(255,255,255,.08)'
    }
  }, [['62', 'Sessions'], ['94%', 'Attendance'], ['128', 'Clients']].map(([v, l]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      letterSpacing: '-0.03em'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--desk-text-muted)',
      marginTop: 2
    }
  }, l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '22px 0 10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 900,
      letterSpacing: '0.22em',
      color: 'var(--desk-text-subtle)'
    }
  }, "NEXT UP"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--brand-primary)'
    }
  }, "See all 3")), /*#__PURE__*/React.createElement(Card, {
    radius: 26,
    padding: "18px 20px",
    style: {
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(AvatarChip, {
    initials: "AO",
    size: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "Adaeze Okonkwo"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-muted)'
    }
  }, "14:00 \xB7 Individual \xB7 Telehealth")), /*#__PURE__*/React.createElement(StatusPill, {
    status: "active",
    height: 24,
    style: {
      marginLeft: 'auto',
      fontSize: 10.5,
      padding: '0 9px'
    }
  }, "Confirmed")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    style: {
      flex: 1,
      height: 46,
      borderRadius: 15
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.play,
      size: 15
    })
  }, "Start session"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    style: {
      width: 46,
      height: 46,
      borderRadius: 15,
      padding: 0
    },
    "aria-label": "Edit"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.pencil,
    size: 16
  })))), [['15:30', 'Tunde Bello', 'Individual · In-person', 'TB', 'tenant'], ['17:00', 'Ngozi & Michael', 'Couples · Telehealth', 'NM', 'secondary']].map(([t, n, s, ini, tone]) => /*#__PURE__*/React.createElement(Card, {
    key: n,
    radius: 22,
    padding: "14px 16px",
    style: {
      marginTop: 10,
      boxShadow: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      flex: 'none',
      fontSize: 13,
      fontWeight: 800
    }
  }, t), /*#__PURE__*/React.createElement(AvatarChip, {
    initials: ini,
    size: 34,
    tone: tone
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--desk-text-muted)'
    }
  }, s))))));
}
function MobileSchedule() {
  const {
    Card,
    Button
  } = window.DESK;
  const days = [['M', '3'], ['T', '4'], ['W', '5'], ['T', '6'], ['F', '7'], ['S', '8'], ['S', '9']];
  const sessions = [['09:00', '50 min', 'Chidi Nwosu', 'Individual', 'tenant'], ['11:30', '50 min', 'Yemi Adeyemi', 'Individual', 'tenant'], ['14:00', '60 min', 'Ngozi & Michael', 'Couples', 'secondary']];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: M.body
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '4px 0 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: '-0.035em'
    }
  }, "Schedule"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    style: {
      marginLeft: 'auto',
      borderRadius: 999
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.plus,
      size: 14
    })
  }, "Session")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, days.map(([d, n], i) => {
    const on = i === 4,
      weekend = i > 4;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: 66,
        borderRadius: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: on ? 'var(--brand-primary)' : 'var(--desk-card)',
        border: '1px solid ' + (on ? 'var(--brand-primary)' : 'var(--desk-border)'),
        color: on ? '#fff' : weekend ? 'var(--desk-border-strong)' : 'var(--desk-text)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.1em',
        opacity: .7
      }
    }, d), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 700
      }
    }, n), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 4,
        height: 4,
        borderRadius: 999,
        background: on ? 'rgba(255,255,255,.7)' : weekend ? 'transparent' : 'var(--brand-dot)'
      }
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      margin: '22px 0 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 900,
      letterSpacing: '0.22em',
      color: 'var(--desk-text-subtle)'
    }
  }, "FRIDAY, 7 AUGUST"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 11.5,
      color: 'var(--desk-text-muted)'
    }
  }, "3 sessions \xB7 2h 50m")), sessions.map(([t, dur, n, cat, tone]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: 'flex',
      gap: 12,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      flex: 'none',
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 800
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--desk-text-subtle)'
    }
  }, dur)), /*#__PURE__*/React.createElement(Card, {
    radius: 20,
    padding: "14px 16px",
    style: {
      flex: 1,
      boxShadow: 'none',
      borderLeft: '4px solid ' + (tone === 'secondary' ? 'var(--brand-secondary)' : 'var(--brand-primary)')
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 700
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-muted)',
      marginTop: 3
    }
  }, cat, " \xB7 Telehealth"))))));
}
function MobileClients() {
  const {
    Card,
    Input,
    AvatarChip
  } = window.DESK;
  const chips = ['All', 'Active', 'Intake', 'Paused'];
  const rows = [['AO', 'Adaeze Okonkwo', 'Individual · 14 sessions', 'active', 'tenant'], ['TB', 'Tunde Bello', 'Individual · 22 sessions', 'active', 'tenant'], ['NM', 'Ngozi & Michael', 'Couples · 3 sessions', 'pending', 'secondary'], ['CN', 'Chidi Nwosu', 'Individual · 31 sessions', 'active', 'tenant'], ['AE', 'Ada & Emeka', 'Couples · 11 sessions', 'inactive', 'secondary']];
  const dotColor = {
    active: 'var(--desk-active-dot)',
    pending: 'var(--desk-pending-dot)',
    inactive: 'var(--desk-inactive)'
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: M.body
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      padding: '4px 0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: '-0.035em'
    }
  }, "Clients"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 12,
      color: 'var(--desk-text-muted)'
    }
  }, "128 active")), /*#__PURE__*/React.createElement(Input, {
    muted: true,
    height: 46,
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.search,
      size: 16
    }),
    placeholder: "Search clients",
    wrapperStyle: {
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 16
    }
  }, chips.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: c,
    style: {
      height: 32,
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 600,
      background: i === 0 ? 'var(--desk-sidebar)' : 'var(--desk-card)',
      color: i === 0 ? '#fff' : 'var(--desk-text-muted)',
      border: '1px solid ' + (i === 0 ? 'var(--desk-sidebar)' : 'var(--desk-border)')
    }
  }, c))), rows.map(([ini, n, s, st, tone]) => /*#__PURE__*/React.createElement(Card, {
    key: n,
    radius: 22,
    padding: "12px 14px",
    style: {
      marginBottom: 8,
      boxShadow: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(AvatarChip, {
    initials: ini,
    size: 44,
    tone: tone
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 700
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--desk-text-muted)'
    }
  }, s)), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      width: 8,
      height: 8,
      borderRadius: 999,
      background: dotColor[st]
    }
  }), /*#__PURE__*/React.createElement(Icon, {
    d: ICON.chevronRight,
    size: 16,
    style: {
      color: 'var(--desk-border-strong)'
    }
  })))));
}
function MobileBrand({
  brand,
  setBrand,
  active,
  setActive
}) {
  const {
    Card,
    Eyebrow,
    Button,
    Toggle,
    ColorField,
    PresetSwatches
  } = window.DESK;
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);
  const copy = () => {
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: M.body
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: '-0.035em',
      padding: '4px 0 16px'
    }
  }, "Brand"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 28,
      padding: '20px 22px',
      background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
      boxShadow: '0 16px 36px var(--brand-ring)',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "invert"
  }, "Your booking link"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      marginTop: 10
    }
  }, "unclutterdesk.com/booking/dr-smith"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: copy,
    style: {
      flex: 1,
      height: 44,
      borderRadius: 15,
      border: 'none',
      cursor: 'pointer',
      background: '#fff',
      color: 'var(--desk-text)',
      fontSize: 13.5,
      fontWeight: 700,
      fontFamily: 'var(--font-primary)'
    }
  }, copied ? 'Copied' : 'Copy link'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      width: 100,
      height: 44,
      borderRadius: 15,
      cursor: 'pointer',
      background: 'rgba(255,255,255,.18)',
      border: '1px solid rgba(255,255,255,.3)',
      color: '#fff',
      fontSize: 13.5,
      fontWeight: 700,
      fontFamily: 'var(--font-primary)'
    }
  }, "Share"))), /*#__PURE__*/React.createElement(Card, {
    radius: 26,
    padding: "18px 20px",
    style: {
      marginTop: 14,
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Brand colours"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(ColorField, {
    label: "Primary",
    value: brand.primary,
    onChange: v => setBrand({
      ...brand,
      primary: v
    })
  }), /*#__PURE__*/React.createElement(ColorField, {
    label: "Secondary",
    value: brand.secondary,
    onChange: v => setBrand({
      ...brand,
      secondary: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(PresetSwatches, {
    value: brand.primary,
    onPick: p => setBrand({
      primary: p.primary,
      secondary: p.secondary
    })
  }))), /*#__PURE__*/React.createElement(Card, {
    radius: 26,
    padding: "18px 20px",
    style: {
      marginTop: 14,
      boxShadow: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Practice status"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      marginTop: 9
    }
  }, active ? 'Active Practice' : 'Inactive Practice'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--desk-text-muted)',
      marginTop: 5,
      textWrap: 'pretty'
    }
  }, active ? 'Your booking page is live.' : 'Your booking page is hidden.')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Toggle, {
    checked: active,
    onChange: setActive,
    width: 58
  }))), /*#__PURE__*/React.createElement(Card, {
    radius: 26,
    padding: "16px 18px",
    style: {
      marginTop: 14,
      boxShadow: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      background: 'var(--desk-surface)',
      border: '1px solid var(--desk-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--desk-text-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.file,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "jane-smith-logo.svg"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--desk-text-subtle)'
    }
  }, "SVG or PNG \xB7 max 2 MB")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    style: {
      marginLeft: 'auto'
    }
  }, "Replace"))));
}
function MobileBooking() {
  const {
    Card,
    Badge,
    Input,
    Button,
    Logo
  } = window.DESK;
  const dates = [['Mon', '10'], ['Tue', '11'], ['Wed', '12'], ['Thu', '13'], ['Fri', '14'], ['Mon', '17']];
  const slots = ['9:00 AM', '11:30 AM', '2:00 PM', '4:30 PM'];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 10px',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 38,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      background: 'var(--desk-surface-muted)',
      borderRadius: 12,
      fontSize: 12,
      color: 'var(--desk-text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.lock,
    size: 12,
    style: {
      color: 'var(--desk-active)'
    }
  }), "booking.drsmiththerapy.com")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 20px',
      background: 'linear-gradient(140deg, var(--brand-tint), var(--brand-secondary-tint))',
      borderBottom: '1px solid var(--brand-ring)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 62,
      height: 62,
      borderRadius: 22,
      background: '#fff',
      boxShadow: '0 8px 24px rgba(15,23,42,.10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 20,
      fontWeight: 800,
      color: 'var(--brand-primary)'
    }
  }, "JS"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'var(--brand-primary)',
      marginTop: 14
    }
  }, "Dr. Jane Smith Therapy"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      letterSpacing: '-0.03em',
      marginTop: 8
    }
  }, "Dr. Jane Smith"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "secondary",
    height: 20
  }, "Clinical psychology"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12.5,
      color: 'var(--desk-text-body)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.star,
    size: 13,
    fill: "var(--desk-pine-500)",
    style: {
      color: 'var(--desk-pine-500)'
    }
  }), /*#__PURE__*/React.createElement("strong", null, "4.9")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    radius: 20,
    padding: 16,
    style: {
      border: '2px solid var(--brand-primary)',
      boxShadow: '0 8px 24px var(--brand-ring)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 700
    }
  }, "50-minute Individual Session"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-muted)',
      marginTop: 4
    }
  }, "One-to-one \xB7 online or in person")), /*#__PURE__*/React.createElement(Badge, {
    tone: "tenantSolid",
    style: {
      marginLeft: 'auto',
      flex: 'none'
    }
  }, "Selected")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: '-0.03em',
      marginTop: 10
    }
  }, "\u20A630,000")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, dates.map(([d, n], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: 62,
      borderRadius: 18,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      background: i === 1 ? 'var(--brand-primary)' : 'var(--desk-surface)',
      border: '1px solid ' + (i === 1 ? 'var(--brand-primary)' : 'var(--desk-border)'),
      color: i === 1 ? '#fff' : 'var(--desk-text)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      fontWeight: 800,
      opacity: .7
    }
  }, d), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, n)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, slots.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      height: 42,
      display: 'flex',
      alignItems: 'center',
      padding: '0 18px',
      borderRadius: 999,
      fontSize: 13.5,
      fontWeight: 700,
      background: i === 1 ? 'var(--brand-primary)' : '#fff',
      border: '1.5px solid ' + (i === 1 ? 'var(--brand-primary)' : 'var(--desk-border)'),
      color: i === 1 ? '#fff' : 'var(--desk-text)'
    }
  }, t))), /*#__PURE__*/React.createElement(Input, {
    label: "Full name",
    placeholder: "Adaeze Okonkwo",
    height: 50
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Email address",
    placeholder: "adaeze@email.com",
    height: 50
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Phone number",
    placeholder: "+234 801 234 5678",
    height: 50
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 4
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    variant: "poweredBy",
    assetBase: "../../"
  })), "        ")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      padding: '14px 20px 26px',
      background: 'var(--desk-glass-bg)',
      backdropFilter: 'var(--desk-glass-blur)',
      WebkitBackdropFilter: 'var(--desk-glass-blur)',
      borderTop: '1px solid var(--desk-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--desk-text-muted)'
    }
  }, "Tue 11 Aug \xB7 11:30 AM"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 19,
      fontWeight: 800,
      letterSpacing: '-0.03em'
    }
  }, "\u20A630,000")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    style: {
      height: 54,
      borderRadius: 18,
      boxShadow: 'var(--desk-shadow-tenant)'
    },
    iconAfter: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.arrowRight,
      size: 17
    })
  }, "Confirm & Book Session")));
}
window.M = M;
window.MobileToday = MobileToday;
window.MobileSchedule = MobileSchedule;
window.MobileClients = MobileClients;
window.MobileBrand = MobileBrand;
window.MobileBooking = MobileBooking;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/Screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/app.jsx
try { (() => {
/* Mobile kit board — the five screens side by side, each with the shared
   frosted bottom navigation (the public booking screen has none). */

function MobileApp() {
  const {
    BottomNav
  } = window.DESK;
  /* House defaults, so the frames agree with the Desk chrome out of the box. */
  const [brand, setBrand] = React.useState({
    primary: '#24614F',
    secondary: '#8A5A3C'
  });
  const [active, setActive] = React.useState(true);
  const tabs = [{
    label: 'Today',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.home,
      size: 20
    })
  }, {
    label: 'Schedule',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.calendar,
      size: 20
    })
  }, {
    label: 'Clients',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.users,
      size: 20
    })
  }, {
    label: 'Brand',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.brush,
      size: 20
    })
  }];
  const screens = [{
    tab: 'Today',
    label: '1 · Today',
    node: /*#__PURE__*/React.createElement(MobileToday, null)
  }, {
    tab: 'Schedule',
    label: '2 · Schedule',
    node: /*#__PURE__*/React.createElement(MobileSchedule, null)
  }, {
    tab: 'Clients',
    label: '3 · Clients',
    node: /*#__PURE__*/React.createElement(MobileClients, null)
  }, {
    tab: 'Brand',
    label: '4 · Brand & link',
    node: /*#__PURE__*/React.createElement(MobileBrand, {
      brand: brand,
      setBrand: setBrand,
      active: active,
      setActive: setActive
    })
  }, {
    tab: null,
    label: '5 · Client booking',
    node: /*#__PURE__*/React.createElement(MobileBooking, null)
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "desk-tenant",
    style: {
      display: 'flex',
      gap: 32,
      padding: '40px 44px',
      alignItems: 'flex-start',
      '--brand-primary': brand.primary,
      '--brand-secondary': brand.secondary
    }
  }, screens.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 900,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: 'var(--desk-text-subtle)'
    }
  }, s.label), /*#__PURE__*/React.createElement("div", {
    style: M.frame
  }, s.node, s.tab && /*#__PURE__*/React.createElement(BottomNav, {
    items: tabs,
    active: s.tab
  })))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(MobileApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/workspace/Analytics.jsx
try { (() => {
/* Analytics (/analytics) — practice performance over time and where bookings come from. */

const MONTHS_12 = [{
  label: 'Sep',
  value: 238
}, {
  label: 'Oct',
  value: 262
}, {
  label: 'Nov',
  value: 251
}, {
  label: 'Dec',
  value: 305
}, {
  label: 'Jan',
  value: 288
}, {
  label: 'Feb',
  value: 331
}, {
  label: 'Mar',
  value: 318
}, {
  label: 'Apr',
  value: 372
}, {
  label: 'May',
  value: 355
}, {
  label: 'Jun',
  value: 401
}, {
  label: 'Jul',
  value: 380
}, {
  label: 'Aug',
  value: 450,
  current: true
}];
const SOURCES = [{
  label: 'Direct booking link',
  meta: '1,412 views',
  percent: 48
}, {
  label: 'booking.drsmiththerapy.com',
  meta: '926 views',
  percent: 32
}, {
  label: 'Referral from GP network',
  meta: '412 views',
  percent: 14
}, {
  label: 'Instagram bio',
  meta: '190 views',
  percent: 6
}];
function Analytics() {
  const {
    Card,
    Eyebrow,
    StatTile,
    BarChart,
    ProgressRow
  } = window.DESK;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Revenue \xB7 12 mo",
    value: "\u20A64.28M",
    delta: "+31.4%"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Sessions delivered",
    value: "618",
    delta: "+12.9%"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Client retention",
    value: "78%",
    delta: "+4.1 pts"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "No-show rate",
    value: "6%",
    delta: "\u22122.3 pts"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Booking page views",
    value: "2,940",
    delta: "+58%"
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-card-title"
  }, "Revenue by month"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--desk-text-muted)'
    }
  }, "Sep 2025 \u2014 Aug 2026 \xB7 \u20A64,281,000 total")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: MONTHS_12,
    height: 200,
    gap: 14,
    showValues: true,
    formatValue: v => '₦' + v + 'k'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Eyebrow, null, "Session mix"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(ProgressRow, {
    label: "Individual \xB7 50 min",
    meta: "412 sessions",
    percent: 67
  }), /*#__PURE__*/React.createElement(ProgressRow, {
    label: "Couples \xB7 80 min",
    meta: "128 sessions",
    percent: 21,
    tone: "secondary"
  }), /*#__PURE__*/React.createElement(ProgressRow, {
    label: "Intake consults",
    meta: "78 sessions",
    percent: 12,
    tone: "muted"
  }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Eyebrow, null, "Where bookings come from"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, SOURCES.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      padding: '13px 0',
      borderTop: i === 0 ? 'none' : '1px solid var(--desk-border-soft)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, s.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-subtle)',
      whiteSpace: 'nowrap'
    }
  }, s.meta), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      width: 40,
      textAlign: 'right',
      fontSize: 13.5,
      fontWeight: 800,
      fontVariantNumeric: 'tabular-nums'
    }
  }, s.percent, "%")))))));
}
function AnalyticsHeaderActions({
  range,
  setRange
}) {
  const {
    SegmentedControl,
    Button
  } = window.DESK;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ['30 days', '90 days', '12 months'],
    value: range,
    onChange: setRange
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.download,
      size: 15
    })
  }, "Download report"));
}
window.Analytics = Analytics;
window.AnalyticsHeaderActions = AnalyticsHeaderActions;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/workspace/Analytics.jsx", error: String((e && e.message) || e) }); }

// ui_kits/workspace/BrandSettings.jsx
try { (() => {
/* Brand Settings (/brand) — the two tenant hexes, and a live scaled preview
   of the public booking page they drive. */

function BrandSettings({
  brand,
  setBrand,
  active,
  setActive,
  preview,
  setPreview
}) {
  const {
    Card,
    Eyebrow,
    Badge,
    StatusPill,
    Button,
    Input,
    Toggle,
    ColorField,
    PresetSwatches,
    SegmentedControl
  } = window.DESK;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '400px minmax(0,1fr)',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "22px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Brand styling"), /*#__PURE__*/React.createElement("div", {
    className: "d-card-title",
    style: {
      marginTop: 8,
      fontSize: 15.5
    }
  }, "Your booking page")), /*#__PURE__*/React.createElement(Badge, {
    tone: "pine",
    style: {
      marginLeft: 'auto'
    }
  }, "White-label")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(ColorField, {
    label: "Primary",
    value: brand.primary,
    onChange: v => setBrand({
      ...brand,
      primary: v
    })
  }), /*#__PURE__*/React.createElement(ColorField, {
    label: "Secondary",
    value: brand.secondary,
    onChange: v => setBrand({
      ...brand,
      secondary: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--desk-text-subtle)'
    }
  }, "Presets"), /*#__PURE__*/React.createElement(PresetSwatches, {
    value: brand.primary,
    onPick: p => setBrand({
      primary: p.primary,
      secondary: p.secondary
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      border: '1.5px dashed var(--desk-border-strong)',
      borderRadius: 16,
      background: 'var(--desk-surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      background: '#fff',
      border: '1px solid var(--desk-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--desk-text-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.file,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "jane-smith-logo.svg"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--desk-text-subtle)'
    }
  }, "SVG or PNG \xB7 max 2 MB \xB7 replace")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    style: {
      marginLeft: 'auto'
    }
  }, "Upload")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: 'var(--desk-text-body)'
    }
  }, "Custom domain (CNAME)"), /*#__PURE__*/React.createElement(StatusPill, {
    status: "active",
    dot: false,
    height: 20,
    style: {
      fontSize: 10,
      letterSpacing: '0.06em'
    }
  }, "Verified")), /*#__PURE__*/React.createElement(Input, {
    muted: true,
    readOnly: true,
    height: 44,
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.globe,
      size: 15
    }),
    defaultValue: "booking.drsmiththerapy.com"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--desk-text-subtle)',
      marginTop: 8
    }
  }, "Point a CNAME record at", ' ', /*#__PURE__*/React.createElement("span", {
    className: "d-mono",
    style: {
      background: 'var(--desk-surface-muted)',
      borderRadius: 5,
      padding: '1px 5px',
      color: 'var(--desk-pine-600)'
    }
  }, "cname.unclutterdesk.com"))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    size: "lg",
    style: {
      marginTop: 18
    }
  }, "Save brand settings")), /*#__PURE__*/React.createElement(Card, {
    padding: "20px 22px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Practice status"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: active ? 'var(--desk-active-dot)' : 'var(--desk-inactive)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, active ? 'Active Practice' : 'Inactive Practice')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-muted)',
      maxWidth: 210,
      marginTop: 8,
      textWrap: 'pretty'
    }
  }, active ? 'Your booking page is live and accepting new client bookings.' : 'Your booking page is hidden. Existing sessions are unaffected.')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Toggle, {
    checked: active,
    onChange: setActive
  }))))), /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '16px 20px',
      borderBottom: '1px solid var(--desk-border)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Live preview"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--desk-text-muted)',
      marginTop: 7
    }
  }, "booking.drsmiththerapy.com \u2014 updates as you pick")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ['Booking', 'Confirmed'],
    value: preview,
    onChange: setPreview,
    height: 36
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 620,
      overflow: 'hidden',
      background: 'var(--desk-surface-alt)'
    }
  }, /*#__PURE__*/React.createElement("iframe", {
    title: "Booking preview",
    src: `../booking/index.html?embed=1&screen=${preview === 'Confirmed' ? 'confirmed' : 'booking'}&primary=${encodeURIComponent(brand.primary)}&secondary=${encodeURIComponent(brand.secondary)}`,
    style: {
      width: 1180,
      height: 1030,
      border: 'none',
      transform: 'scale(.6)',
      transformOrigin: 'top left'
    }
  }))));
}
function BrandHeaderActions() {
  const {
    Button
  } = window.DESK;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.globe,
      size: 15
    })
  }, "View live page"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg"
  }, "Save changes"));
}
window.BrandSettings = BrandSettings;
window.BrandHeaderActions = BrandHeaderActions;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/workspace/BrandSettings.jsx", error: String((e && e.message) || e) }); }

// ui_kits/workspace/Clients.jsx
try { (() => {
/* Clients (/clients) — the caseload roster: volume, status, next appointment. */

const ROSTER = [{
  initials: 'AO',
  name: 'Adaeze Okonkwo',
  email: 'adaeze@email.com',
  care: 'Individual · 50 min',
  sessions: 14,
  next: 'Thu, 7 Aug · 14:00',
  status: 'active',
  label: 'Active',
  tone: 'tenant'
}, {
  initials: 'TB',
  name: 'Tunde Bello',
  email: 'tunde.b@email.com',
  care: 'Individual · 50 min',
  sessions: 22,
  next: 'Thu, 7 Aug · 15:30',
  status: 'active',
  label: 'Active',
  tone: 'tenant'
}, {
  initials: 'NM',
  name: 'Ngozi & Michael',
  email: 'ngozi.m@email.com',
  care: 'Couples · 80 min',
  sessions: 3,
  next: 'Thu, 7 Aug · 17:00',
  status: 'pending',
  label: 'In intake',
  tone: 'secondary'
}, {
  initials: 'CN',
  name: 'Chidi Nwosu',
  email: 'chidi.n@email.com',
  care: 'Individual · 50 min',
  sessions: 31,
  next: 'Mon, 11 Aug · 09:00',
  status: 'active',
  label: 'Active',
  tone: 'tenant'
}, {
  initials: 'FB',
  name: 'Fatima Bakare',
  email: 'fatima@email.com',
  care: 'Individual · 50 min',
  sessions: 8,
  next: 'Wed, 13 Aug · 10:00',
  status: 'active',
  label: 'Active',
  tone: 'tenant'
}, {
  initials: 'AE',
  name: 'Ada & Emeka',
  email: 'ada.e@email.com',
  care: 'Couples · 80 min',
  sessions: 11,
  next: 'Wed, 13 Aug · 15:00',
  status: 'inactive',
  label: 'Paused',
  tone: 'secondary'
}, {
  initials: 'YA',
  name: 'Yemi Adeyemi',
  email: 'yemi.a@email.com',
  care: 'Individual · 50 min',
  sessions: 5,
  next: '—',
  status: 'pending',
  label: 'In intake',
  tone: 'tenant'
}];
const COLS = '2.2fr 1fr .7fr 1.1fr .9fr 90px';
function Clients() {
  const {
    Card,
    StatTile,
    StatusPill,
    AvatarChip,
    IconButton,
    Button
  } = window.DESK;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Active clients",
    value: "128"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "In intake",
    value: "7"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Paused",
    value: "12"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "New this month",
    value: "9"
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    style: {
      overflow: 'hidden',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: COLS,
      gap: 16,
      padding: '14px 22px',
      background: 'var(--desk-surface-alt)',
      borderBottom: '1px solid var(--desk-border)'
    }
  }, ['Client', 'Care type', 'Sessions', 'Next session', 'Status', ''].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 9,
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '0.18em',
      color: 'var(--desk-text-subtle)'
    }
  }, h))), ROSTER.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.name,
    onMouseEnter: e => e.currentTarget.style.background = 'var(--desk-surface-alt)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent',
    style: {
      display: 'grid',
      gridTemplateColumns: COLS,
      gap: 16,
      alignItems: 'center',
      padding: '14px 22px',
      borderBottom: '1px solid var(--desk-border-soft)',
      transition: 'background var(--dur-color) ease-out'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(AvatarChip, {
    initials: c.initials,
    size: 38,
    tone: c.tone
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--desk-text-subtle)'
    }
  }, c.email))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--desk-text-muted)'
    }
  }, c.care), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      fontVariantNumeric: 'tabular-nums'
    }
  }, c.sessions), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--desk-text-body)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, c.next), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(StatusPill, {
    status: c.status
  }, c.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 32,
    variant: "muted",
    "aria-label": "Edit"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.pencil,
    size: 15
  })), /*#__PURE__*/React.createElement(IconButton, {
    size: 32,
    variant: "muted",
    "aria-label": "More"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.more,
    size: 15
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 22px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-subtle)'
    }
  }, "Showing 7 of 128 clients"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    style: {
      height: 30,
      borderRadius: 9
    }
  }, "Previous"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    style: {
      height: 30,
      borderRadius: 9
    }
  }, "Next")))));
}
function ClientsHeaderActions() {
  const {
    Input,
    Button
  } = window.DESK;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Input, {
    muted: true,
    height: 40,
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.search,
      size: 15
    }),
    placeholder: "Search clients",
    wrapperStyle: {
      width: 240
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.download,
      size: 15
    })
  }, "Export"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.plus,
      size: 15
    })
  }, "Add client"));
}
window.Clients = Clients;
window.ClientsHeaderActions = ClientsHeaderActions;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/workspace/Clients.jsx", error: String((e && e.message) || e) }); }

// ui_kits/workspace/Dashboard.jsx
try { (() => {
/* Dashboard (/) — morning check-in: what's earning, who's coming, and
   one-click access to the booking link the therapist shares with clients. */

const REVENUE_12 = [{
  label: 'S',
  value: 238
}, {
  label: 'O',
  value: 262
}, {
  label: 'N',
  value: 251
}, {
  label: 'D',
  value: 305
}, {
  label: 'J',
  value: 288
}, {
  label: 'F',
  value: 331
}, {
  label: 'M',
  value: 318
}, {
  label: 'A',
  value: 372
}, {
  label: 'M',
  value: 355
}, {
  label: 'J',
  value: 401
}, {
  label: 'J',
  value: 380
}, {
  label: 'A',
  value: 450,
  current: true
}];
const TODAY = [{
  start: '14:00',
  end: '15:00',
  initials: 'AO',
  name: 'Adaeze Okonkwo',
  type: 'Individual Therapy',
  mode: 'Telehealth',
  status: 'active',
  statusLabel: 'Confirmed',
  tone: 'tenant'
}, {
  start: '15:30',
  end: '16:20',
  initials: 'TB',
  name: 'Tunde Bello',
  type: 'Individual Therapy',
  mode: 'In-person',
  status: 'active',
  statusLabel: 'Confirmed',
  tone: 'tenant'
}, {
  start: '17:00',
  end: '18:00',
  initials: 'NM',
  name: 'Ngozi & Michael',
  type: 'Couples Therapy',
  mode: 'Telehealth',
  status: 'pending',
  statusLabel: 'Awaiting intake',
  tone: 'secondary'
}];
function SessionRow({
  s
}) {
  const {
    Card,
    AvatarChip,
    StatusPill,
    Button,
    IconButton
  } = window.DESK;
  return /*#__PURE__*/React.createElement(Card, {
    hoverable: true,
    padding: "14px 16px",
    radius: 18,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      letterSpacing: '-0.02em'
    }
  }, s.start), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: 'var(--desk-text-subtle)'
    }
  }, s.end)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 34,
      background: 'var(--desk-border)',
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement(AvatarChip, {
    initials: s.initials,
    size: 38,
    tone: s.tone
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 700
    }
  }, s.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-muted)'
    }
  }, s.type, " \xB7 ", s.mode)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    status: s.status
  }, s.statusLabel), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    style: {
      height: 34,
      borderRadius: 11
    }
  }, "Notes"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    style: {
      height: 34,
      borderRadius: 11
    }
  }, "Start session"), /*#__PURE__*/React.createElement(IconButton, {
    size: 34,
    variant: "muted",
    radius: 11,
    "aria-label": "More"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.more,
    size: 16
  }))));
}
function Dashboard({
  brand,
  setBrand,
  active,
  setActive
}) {
  const {
    Card,
    Eyebrow,
    Badge,
    StatusPill,
    Button,
    IconButton,
    AvatarChip,
    Input,
    Toggle,
    ColorField,
    PresetSwatches,
    StatTile,
    BarChart
  } = window.DESK;
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);
  const copy = () => {
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 372px',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 20,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Revenue this month"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-stat-hero"
  }, "\u20A6450,000"), /*#__PURE__*/React.createElement(StatusPill, {
    status: "active",
    dot: false,
    height: 24
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.chevronUp,
    size: 13
  }), " 18.2%")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--desk-text-muted)',
      marginTop: 8
    }
  }, "August 2026 \xB7 vs \u20A6380,500 in July")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    compact: true,
    label: "Total sessions",
    value: "62"
  }), /*#__PURE__*/React.createElement(StatTile, {
    compact: true,
    label: "Avg. per session",
    value: "\u20A67,258"
  }), /*#__PURE__*/React.createElement(StatTile, {
    compact: true,
    label: "Attendance",
    value: "94%"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: REVENUE_12,
    height: 96
  }))), /*#__PURE__*/React.createElement(Card, {
    padding: "22px 24px 24px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Upcoming"), /*#__PURE__*/React.createElement("div", {
    className: "d-card-title",
    style: {
      marginTop: 8
    }
  }, "Client sessions today")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      height: 32,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      borderRadius: 10,
      background: 'var(--desk-surface-muted)',
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--desk-text-body)'
    }
  }, "Thu, 7 Aug"), /*#__PURE__*/React.createElement(Button, {
    variant: "link",
    size: "sm",
    style: {
      height: 32,
      borderRadius: 10
    }
  }, "View schedule"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 16
    }
  }, TODAY.map(s => /*#__PURE__*/React.createElement(SessionRow, {
    key: s.name,
    s: s
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "22px"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Profile photo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(AvatarChip, {
    initials: "JS",
    size: 76,
    ring: true,
    online: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "Dr. Jane Smith"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--desk-text-muted)'
    }
  }, "Clinical Psychologist \xB7 MSc"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 6,
      fontSize: 11.5,
      color: 'var(--desk-text-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.info,
    size: 13
  }), " JPG or PNG \xB7 max 2 MB"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    style: {
      flex: 1
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.upload,
      size: 15
    })
  }, "Upload Photo"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "Remove"))), /*#__PURE__*/React.createElement(Card, {
    padding: "20px 22px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Practice status"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: active ? 'var(--desk-active-dot)' : 'var(--desk-inactive)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, active ? 'Active Practice' : 'Inactive Practice')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--desk-text-muted)',
      maxWidth: 210,
      marginTop: 8,
      textWrap: 'pretty'
    }
  }, active ? 'Your booking page is live and accepting new client bookings.' : 'Your booking page is hidden. Existing sessions are unaffected.')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Toggle, {
    checked: active,
    onChange: setActive
  })))), /*#__PURE__*/React.createElement(Card, {
    padding: "22px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Brand styling"), /*#__PURE__*/React.createElement("div", {
    className: "d-card-title",
    style: {
      marginTop: 8,
      fontSize: 15.5
    }
  }, "Your booking page")), /*#__PURE__*/React.createElement(Badge, {
    tone: "pine",
    style: {
      marginLeft: 'auto'
    }
  }, "White-label")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(ColorField, {
    label: "Primary",
    value: brand.primary,
    onChange: v => setBrand({
      ...brand,
      primary: v
    })
  }), /*#__PURE__*/React.createElement(ColorField, {
    label: "Secondary",
    value: brand.secondary,
    onChange: v => setBrand({
      ...brand,
      secondary: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--desk-text-subtle)'
    }
  }, "Presets"), /*#__PURE__*/React.createElement(PresetSwatches, {
    value: brand.primary,
    onPick: p => setBrand({
      primary: p.primary,
      secondary: p.secondary
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      border: '1.5px dashed var(--desk-border-strong)',
      borderRadius: 16,
      background: 'var(--desk-surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      background: '#fff',
      border: '1px solid var(--desk-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--desk-text-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.file,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "jane-smith-logo.svg"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--desk-text-subtle)'
    }
  }, "SVG or PNG \xB7 max 2 MB \xB7 replace")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    style: {
      marginLeft: 'auto'
    }
  }, "Upload")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: 'var(--desk-text-body)'
    }
  }, "Custom domain (CNAME)"), /*#__PURE__*/React.createElement(StatusPill, {
    status: "active",
    dot: false,
    height: 20,
    style: {
      fontSize: 10,
      letterSpacing: '0.06em'
    }
  }, "Verified")), /*#__PURE__*/React.createElement(Input, {
    muted: true,
    readOnly: true,
    height: 44,
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.globe,
      size: 15
    }),
    defaultValue: "booking.drsmiththerapy.com"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--desk-text-subtle)',
      marginTop: 8
    }
  }, "Point a CNAME record at", ' ', /*#__PURE__*/React.createElement("span", {
    className: "d-mono",
    style: {
      background: 'var(--desk-surface-muted)',
      borderRadius: 5,
      padding: '1px 5px',
      color: 'var(--desk-pine-600)'
    }
  }, "cname.unclutterdesk.com"))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    size: "lg",
    style: {
      marginTop: 18
    }
  }, "Save brand settings"))));
}

/* Header action cluster for this screen — rendered by the shell. */
function DashboardHeaderActions() {
  const {
    Input,
    Button,
    IconButton
  } = window.DESK;
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);
  const copy = () => {
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Input, {
    muted: true,
    readOnly: true,
    mono: true,
    height: 44,
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.link,
      size: 15
    }),
    value: "unclutterdesk.com/booking/dr-smith",
    onChange: () => {},
    wrapperStyle: {
      width: 320
    },
    trailing: /*#__PURE__*/React.createElement(IconButton, {
      size: 32,
      variant: "plain",
      onClick: copy,
      "aria-label": "Copy booking link"
    }, /*#__PURE__*/React.createElement(Icon, {
      d: copied ? ICON.check : ICON.copy,
      size: 14
    }))
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: copy,
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: copied ? ICON.check : ICON.copy,
      size: 15
    })
  }, copied ? 'Link copied' : 'Copy Booking Link'), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 28,
      background: 'var(--desk-border)'
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 44,
    dot: true,
    "aria-label": "Notifications"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.bell,
    size: 18
  })));
}
window.Dashboard = Dashboard;
window.DashboardHeaderActions = DashboardHeaderActions;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/workspace/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/workspace/Schedule.jsx
try { (() => {
/* Schedule (/schedule) — see and manage the working week. */

const WEEK_DAYS = [{
  dow: 'MON',
  date: '3'
}, {
  dow: 'TUE',
  date: '4'
}, {
  dow: 'WED',
  date: '5'
}, {
  dow: 'THU',
  date: '6'
}, {
  dow: 'FRI',
  date: '7'
}];

/* category: 'individual' | 'couples' | 'admin' */
const EVENTS = [{
  day: 0,
  start: 9 * 60,
  dur: 50,
  title: 'Chidi Nwosu',
  sub: 'Individual · Telehealth',
  cat: 'individual'
}, {
  day: 0,
  start: 11 * 60,
  dur: 50,
  title: 'Adaeze Okonkwo',
  sub: 'Individual · In-person',
  cat: 'individual'
}, {
  day: 0,
  start: 14 * 60,
  dur: 60,
  title: 'Supervision',
  sub: 'Admin block',
  cat: 'admin'
}, {
  day: 1,
  start: 9 * 60 + 30,
  dur: 80,
  title: 'Ngozi & Michael',
  sub: 'Couples · Telehealth',
  cat: 'couples'
}, {
  day: 1,
  start: 13 * 60,
  dur: 50,
  title: 'Tunde Bello',
  sub: 'Individual · In-person',
  cat: 'individual'
}, {
  day: 1,
  start: 16 * 60,
  dur: 45,
  title: 'Intake calls',
  sub: 'Admin block',
  cat: 'admin'
}, {
  day: 2,
  start: 10 * 60,
  dur: 50,
  title: 'Fatima Bakare',
  sub: 'Individual · Telehealth',
  cat: 'individual'
}, {
  day: 2,
  start: 12 * 60,
  dur: 60,
  title: 'Notes & billing',
  sub: 'Admin block',
  cat: 'admin'
}, {
  day: 2,
  start: 15 * 60,
  dur: 80,
  title: 'Ada & Emeka',
  sub: 'Couples · In-person',
  cat: 'couples'
}, {
  day: 3,
  start: 9 * 60,
  dur: 50,
  title: 'Chidi Nwosu',
  sub: 'Individual · Telehealth',
  cat: 'individual'
}, {
  day: 3,
  start: 11 * 60 + 30,
  dur: 50,
  title: 'Yemi Adeyemi',
  sub: 'Individual · Telehealth',
  cat: 'individual'
}, {
  day: 3,
  start: 14 * 60,
  dur: 60,
  title: 'Supervision',
  sub: 'Admin block',
  cat: 'admin'
}, {
  day: 4,
  start: 14 * 60,
  dur: 60,
  title: 'Adaeze Okonkwo',
  sub: 'Individual · Telehealth',
  cat: 'individual'
}, {
  day: 4,
  start: 15 * 60 + 30,
  dur: 50,
  title: 'Tunde Bello',
  sub: 'Individual · In-person',
  cat: 'individual'
}, {
  day: 4,
  start: 17 * 60,
  dur: 60,
  title: 'Ngozi & Michael',
  sub: 'Couples · Telehealth',
  cat: 'couples'
}];
const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'];
const ROW_H = 62;
const ORIGIN = 9 * 60;
function catColor(cat) {
  if (cat === 'individual') return 'var(--brand-primary)';
  if (cat === 'couples') return 'var(--brand-secondary)';
  return 'var(--desk-border-strong)';
}
function ScheduleEvent({
  e
}) {
  const color = catColor(e.cat);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 6,
      right: 6,
      top: (e.start - ORIGIN) / 60 * ROW_H,
      height: e.dur / 60 * ROW_H - 5,
      borderRadius: 12,
      padding: '8px 10px',
      overflow: 'hidden',
      background: `color-mix(in srgb, ${color} 8%, #fff)`,
      border: `1px solid color-mix(in srgb, ${color} 33%, #fff)`,
      borderLeft: `3px solid ${color}`,
      cursor: 'pointer',
      transition: 'filter var(--dur-color) ease-out'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--desk-text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.sub));
}
function Schedule() {
  const {
    Card,
    IconButton
  } = window.DESK;
  const legend = [{
    c: 'var(--brand-primary)',
    l: 'Individual'
  }, {
    c: 'var(--brand-secondary)',
    l: 'Couples'
  }, {
    c: 'var(--desk-border-strong)',
    l: 'Admin block'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "3 \u2014 7 August 2026"), /*#__PURE__*/React.createElement(IconButton, {
    size: 32,
    variant: "outline",
    "aria-label": "Previous week"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.chevronLeft,
    size: 16
  })), /*#__PURE__*/React.createElement(IconButton, {
    size: 32,
    variant: "outline",
    "aria-label": "Next week"
  }, /*#__PURE__*/React.createElement(Icon, {
    d: ICON.chevronRight,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, legend.map(g => /*#__PURE__*/React.createElement("span", {
    key: g.l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 11.5,
      color: 'var(--desk-text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 4,
      background: g.c
    }
  }), g.l)))), /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    style: {
      overflow: 'hidden',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '64px repeat(5, 1fr)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--desk-surface-alt)',
      borderRight: '1px solid var(--desk-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 58
    }
  }), HOURS.map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      height: ROW_H,
      textAlign: 'right',
      paddingRight: 10,
      fontSize: 10.5,
      fontWeight: 600,
      color: 'var(--desk-text-subtle)',
      transform: 'translateY(-6px)'
    }
  }, h))), WEEK_DAYS.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: d.dow,
    style: {
      borderRight: i < 4 ? '1px solid var(--desk-border)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 58,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      borderBottom: '1px solid var(--desk-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 900,
      letterSpacing: '0.18em',
      color: 'var(--desk-text-subtle)'
    }
  }, d.dow), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, d.date)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: ROW_H * HOURS.length,
      background: `repeating-linear-gradient(#fff 0 ${ROW_H - 1}px, #EEF2F6 ${ROW_H - 1}px ${ROW_H}px)`
    }
  }, EVENTS.filter(e => e.day === i).map((e, k) => /*#__PURE__*/React.createElement(ScheduleEvent, {
    key: k,
    e: e
  }))))))));
}
function ScheduleHeaderActions({
  view,
  setView
}) {
  const {
    SegmentedControl,
    Button
  } = window.DESK;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ['Week', 'Day', 'Month'],
    value: view,
    onChange: setView
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg"
  }, "Set availability"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.plus,
      size: 15
    })
  }, "New session"));
}
window.Schedule = Schedule;
window.ScheduleHeaderActions = ScheduleHeaderActions;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/workspace/Schedule.jsx", error: String((e && e.message) || e) }); }

// ui_kits/workspace/app.jsx
try { (() => {
/* Workspace shell — sidebar navigation across the five therapist screens. */

function App() {
  const {
    Sidebar,
    AppHeader
  } = window.DESK;
  const [screen, setScreen] = React.useState('dashboard');
  /* House defaults, so the sidebar's pine chrome and the dashboard accents
     agree out of the box. Pick a preset in Brand Settings to see a tenant. */
  const [brand, setBrand] = React.useState({
    primary: '#24614F',
    secondary: '#8A5A3C'
  });
  const [active, setActive] = React.useState(true);
  const [view, setView] = React.useState('Week');
  const [range, setRange] = React.useState('12 months');
  const [preview, setPreview] = React.useState('Booking');
  const items = [{
    key: 'dashboard',
    label: 'Dashboard',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.home
    })
  }, {
    key: 'schedule',
    label: 'Schedule',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.calendar
    }),
    count: '4',
    countTone: 'pine'
  }, {
    key: 'clients',
    label: 'Clients',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.users
    }),
    count: '128'
  }, {
    key: 'brand',
    label: 'Brand Settings',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.brush
    })
  }, {
    key: 'analytics',
    label: 'Analytics',
    icon: /*#__PURE__*/React.createElement(Icon, {
      d: ICON.chart
    })
  }];
  const meta = {
    dashboard: {
      eyebrow: 'Practice',
      title: 'Dashboard',
      actions: /*#__PURE__*/React.createElement(DashboardHeaderActions, null)
    },
    schedule: {
      eyebrow: 'This week',
      title: 'Schedule',
      actions: /*#__PURE__*/React.createElement(ScheduleHeaderActions, {
        view: view,
        setView: setView
      })
    },
    clients: {
      eyebrow: 'Caseload',
      title: 'Clients',
      actions: /*#__PURE__*/React.createElement(ClientsHeaderActions, null)
    },
    brand: {
      eyebrow: 'White label',
      title: 'Brand Settings',
      actions: /*#__PURE__*/React.createElement(BrandHeaderActions, null)
    },
    analytics: {
      eyebrow: 'Performance',
      title: 'Analytics',
      actions: /*#__PURE__*/React.createElement(AnalyticsHeaderActions, {
        range: range,
        setRange: setRange
      })
    }
  }[screen];
  const body = {
    dashboard: /*#__PURE__*/React.createElement(Dashboard, {
      brand: brand,
      setBrand: setBrand,
      active: active,
      setActive: setActive
    }),
    schedule: /*#__PURE__*/React.createElement(Schedule, null),
    clients: /*#__PURE__*/React.createElement(Clients, null),
    brand: /*#__PURE__*/React.createElement(BrandSettings, {
      brand: brand,
      setBrand: setBrand,
      active: active,
      setActive: setActive,
      preview: preview,
      setPreview: setPreview
    }),
    analytics: /*#__PURE__*/React.createElement(Analytics, null)
  }[screen];
  return /*#__PURE__*/React.createElement("div", {
    className: "desk-tenant",
    style: {
      display: 'flex',
      height: '100%',
      minWidth: 1440,
      '--brand-primary': brand.primary,
      '--brand-secondary': brand.secondary
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    items: items,
    active: screen,
    onSelect: setScreen,
    assetBase: "../../",
    user: {
      initials: 'JS',
      name: 'Dr. Jane Smith',
      role: 'Clinical Psychologist'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(AppHeader, {
    eyebrow: meta.eyebrow,
    title: meta.title
  }, meta.actions), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '24px 26px 30px'
    }
  }, body)));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/workspace/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/workspace/icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Lucide-style icon set — 24×24 viewBox, stroke-width 2, round caps/joins, no fill.
   In production use lucide-react; these are inline copies for the kit. */

const Icon = ({
  d,
  size = 18,
  fill = 'none',
  style,
  ...rest
}) => /*#__PURE__*/React.createElement("svg", _extends({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: fill,
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: {
    flex: 'none',
    ...style
  }
}, rest), Array.isArray(d) ? d.map((p, i) => /*#__PURE__*/React.createElement("path", {
  key: i,
  d: p
})) : /*#__PURE__*/React.createElement("path", {
  d: d
}));
const ICON = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  calendar: ["M8 2v4M16 2v4M3 9h18", "M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 21v-2a4 4 0 0 0-3-3.87"],
  brush: ["M4 20c2-1 3-3 3-5a3 3 0 1 1 5 2", "M14 12l7-7a2 2 0 0 0-3-3l-7 7"],
  chart: "M3 3v18h18M7 15l4-5 3 3 5-7",
  bell: ["M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  link: ["M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1", "M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"],
  copy: ["M8 4h10a2 2 0 0 1 2 2v10", "M16 8H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z"],
  check: "M4 12.5 9.5 18 20 6",
  chevronUp: "M6 15l6-6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  search: ["M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M21 21l-4.3-4.3"],
  plus: "M12 5v14M5 12h14",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  pencil: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M3 12h18", "M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 16v-4M12 8h.01"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  pin: ["M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z", "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  play: "M7 4l12 8-12 8z",
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
  star: "M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.8 6.7 19.7l1.1-6.1L3.4 9.4l6-.8z"
};

/* Babel-standalone evaluates external scripts in their own scope; publish
   the shared helpers so the screen files can reach them. */
window.Icon = Icon;
window.ICON = ICON;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/workspace/icons.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.AvatarChip = __ds_scope.AvatarChip;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.STATUS = __ds_scope.STATUS;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.BarChart = __ds_scope.BarChart;

__ds_ns.ProgressRow = __ds_scope.ProgressRow;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.ColorField = __ds_scope.ColorField;

__ds_ns.BRAND_PRESETS = __ds_scope.BRAND_PRESETS;

__ds_ns.PresetSwatches = __ds_scope.PresetSwatches;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.AppHeader = __ds_scope.AppHeader;

__ds_ns.BottomNav = __ds_scope.BottomNav;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.Sidebar = __ds_scope.Sidebar;

})();

/**
 * DukaanMitra Unified Brand Design System
 * Centralized design tokens for all ecosystem applications
 */

export const brandColors = {
  // Primary Brand Colors
  primary: {
    ink: '#0a0e27',      // Deep Navy - Trust & Professionalism
    gold: '#c9a227',     // Heritage Gold - Premium & Value
    paper: '#f7f5f0',    // Warm Paper - Traditional Merchant Feel
  },

  // Secondary Colors
  secondary: {
    mint: '#25D366',     // WhatsApp-inspired - Communication
    crimson: '#dc2626',  // Alert & Urgency
    slate: '#64748b',    // Neutral Text
  },

  // Semantic Colors
  semantic: {
    success: '#16a34a',
    warning: '#f59e0b',
    error: '#dc2626',
    info: '#2563eb',
  },

  // Gradients
  gradients: {
    brand: 'linear-gradient(135deg, #0a0e27 0%, #1e3a8a 50%, #c9a227 100%)',
    sunset: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)',
    ocean: 'linear-gradient(135deg, #0ea5e9 0%, #25D366 100%)',
  },
} as const;

export const typography = {
  families: {
    display: ['Fraunces', 'Space Grotesk', 'serif'].join(', '),
    heading: ['Space Grotesk', 'Inter', 'sans-serif'].join(', '),
    body: ['Inter', 'Poppins', 'sans-serif'].join(', '),
    mono: ['Space Mono', 'monospace'].join(', '),
  },

  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
  },

  weights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '6rem',   // 96px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
} as const;

export const shadows = {
  subtle: '0 2px 4px rgba(0, 0, 0, 0.05)',
  default: '0 4px 6px rgba(0, 0, 0, 0.1)',
  medium: '0 10px 15px rgba(0, 0, 0, 0.1)',
  large: '0 20px 25px rgba(0, 0, 0, 0.15)',
  xl: '0 25px 50px rgba(0, 0, 0, 0.25)',
  glow: '0 0 20px rgba(201, 162, 39, 0.3)',
} as const;

export const transitions = {
  fast: '150ms ease-in-out',
  normal: '300ms ease-in-out',
  slow: '500ms ease-in-out',
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const zIndices = {
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
} as const;

// Complete design system export
export const designSystem = {
  colors: brandColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  breakpoints,
  zIndices,
} as const;

export default designSystem;

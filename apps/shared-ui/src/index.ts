/**
 * DukaanMitra Shared UI Library
 * Unified design system for all ecosystem applications
 */

// Design Tokens
export { designSystem, brandColors, typography, spacing, borderRadius, shadows, transitions, breakpoints, zIndices } from './design-tokens';

// Components
export { Button } from './components/Button';
export type { ButtonProps } from './components/Button';

export { Card, CardHeader, CardBody, CardFooter } from './components/Card';
export type { CardProps } from './components/Card';

// Re-export as default for convenience
export { default as designTokens } from './design-tokens';

# Color Contrast Verification Utility

This module provides WCAG 2.2 AA and AAA compliance checking for color contrast ratios in user interfaces.

## Overview

The utility implements the [WCAG 2.2 Contrast (Minimum) standard](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) to ensure text is readable for all users, including those with visual impairments.

## Standards

### WCAG 2.2 AA (Minimum Conformance)
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text** (18pt+ or 14pt+ bold): Minimum 3:1 contrast ratio

### WCAG 2.2 AAA (Enhanced Conformance)
- **Normal text**: Minimum 7:1 contrast ratio
- **Large text** (18pt+ or 14pt+ bold): Minimum 4.5:1 contrast ratio

## API Reference

### `calculateContrastRatio(foreground: string, background: string): number`

Calculates the contrast ratio between two colors using the WCAG 2.2 formula.

```typescript
const ratio = calculateContrastRatio('#000000', '#FFFFFF');
// Returns: 21
```

### `checkWCAG_AA_Compliance(foreground: string, background: string): ContrastCompliance`

Checks if a color pair meets WCAG 2.2 AA standards.

```typescript
const compliance = checkWCAG_AA_Compliance('#1e293b', '#ffffff');
// Returns: { normalText: true, largeText: true, ratio: 13.45 }
```

### `checkWCAG_AAA_Compliance(foreground: string, background: string): ContrastComplianceAAA`

Checks if a color pair meets WCAG 2.2 AAA standards.

```typescript
const compliance = checkWCAG_AAA_Compliance('#000000', '#FFFFFF');
// Returns: { normalText: true, largeText: true, ratio: 21 }
```

### `getComplianceSummary(compliance: ContrastCompliance): string`

Returns a human-readable summary of compliance status.

```typescript
const compliance = checkWCAG_AA_Compliance('#000000', '#FFFFFF');
const summary = getComplianceSummary(compliance);
// Returns: "✓ WCAG AA (21:1)"
```

### `getSuggestionsForImprovement(foreground: string, background: string): string[]`

Provides actionable suggestions for improving color contrast.

```typescript
const suggestions = getSuggestionsForImprovement('#ffffff', '#fffbf0');
// Returns: [
//   "Consider making the foreground color darker or the background lighter",
//   "For dark backgrounds, increase brightness of foreground color",
//   "For light backgrounds, decrease brightness of foreground color"
// ]
```

### `validateColorPairs(pairs: Array<{ fg: string; bg: string }>): ColorPairValidation[]`

Validates multiple color pairs at once.

```typescript
const results = validateColorPairs([
  { fg: '#000000', bg: '#FFFFFF' },
  { fg: '#FFFFFF', bg: '#000000' },
  { fg: '#374151', bg: '#f3f4f6' }
]);
// Returns array of validation results
```

## Color Format

All color inputs should be in hexadecimal format:
- With `#`: `#FF0000`
- Without `#`: `FF0000`
- Case-insensitive: `#ff0000`

## Utility Functions

### `hexToRgb(hex: string): { r: number; g: number; b: number } | null`

Converts hex color to RGB values.

```typescript
const rgb = hexToRgb('#FF0000');
// Returns: { r: 255, g: 0, b: 0 }
```

### `rgbToHex(r: number, g: number, b: number): string`

Converts RGB values to hex color.

```typescript
const hex = rgbToHex(255, 0, 0);
// Returns: "#FF0000"
```

### `calculateLuminance(r: number, g: number, b: number): number`

Calculates relative luminance according to WCAG 2.2 formula.

```typescript
const luminance = calculateLuminance(0, 0, 0);
// Returns: 0 (black)

const luminance = calculateLuminance(255, 255, 255);
// Returns: 1 (white)
```

## Usage Examples

### Validating Heading Color

```typescript
import { checkWCAG_AA_Compliance } from '@hari/ui';

const headingColor = '#1e293b';
const backgroundColor = '#ffffff';

const compliance = checkWCAG_AA_Compliance(headingColor, backgroundColor);

if (!compliance.normalText) {
  console.warn('Heading color has insufficient contrast');
}
```

### Batch Validation in Components

```typescript
import { validateColorPairs } from '@hari/ui';

const colorPairs = [
  { fg: '#1e293b', bg: '#ffffff' },  // text on light bg
  { fg: '#94a3b8', bg: '#1e293b' },  // secondary text on dark bg
  { fg: '#ef4444', bg: '#fef2f2' },  // error text on error bg
];

const validations = validateColorPairs(colorPairs);
const allCompliant = validations.every(v => v.compliant);

if (!allCompliant) {
  console.error('Some color pairs do not meet WCAG AA standards');
  validations.forEach((v, i) => {
    if (!v.compliant) {
      console.error(`Pair ${i}: ${v.foreground} on ${v.background} (${v.compliance.ratio}:1)`);
    }
  });
}
```

### Dynamically Checking Theme Colors

```typescript
import { checkWCAG_AA_Compliance, getComplianceSummary } from '@hari/ui';

const theme = {
  text: '#1e293b',
  background: '#ffffff',
  accent: '#3b82f6',
  warning: '#f59e0b',
  error: '#ef4444'
};

Object.entries(theme).forEach(([name, color]) => {
  const compliance = checkWCAG_AA_Compliance(color, theme.background);
  console.log(`${name}: ${getComplianceSummary(compliance)}`);
});
```

## Real-World Examples

### Pass Cases ✓

- Black on white: 21:1 (excellent)
- Dark blue (#1e293b) on white: ~13.45:1 (excellent)
- Dark gray (#374151) on light gray (#f3f4f6): ~8.5:1 (excellent)
- Dark red (#991b1b) on light red (#fef2f2): ~7:1 (AAA)
- Dark green (#166534) on light green (#f0fdf4): ~8:1 (AAA)

### Fail Cases ✗

- Light colors on light background (#ffffff on #fffbf0): ~1.1:1
- Similar colors (#666666 on #707070): ~1.1:1
- Pure red (#FF0000) on white: ~3.99:1 (large text only)

## Best Practices

1. **Test Early**: Use this utility during component development, not after.

2. **Test All States**: Check colors in all states (normal, hover, active, disabled, focus).

3. **Consider Context**: Remember that 3:1 is acceptable for large text and UI components (if explicitly marked as non-critical).

4. **Use AA as Minimum**: WCAG 2.2 AA is the minimum legal requirement in many jurisdictions. Aim for AAA when possible.

5. **Dark Mode**: Test both light and dark themes.

6. **Test with Real Users**: Automated checks catch most issues, but user testing with people who have visual impairments is invaluable.

## References

- [WCAG 2.2 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [A11y Project - Color Contrast](https://www.a11yproject.com/posts/what-is-color-contrast/)

/**
 * Color Contrast Verification Utility
 * Implements WCAG 2.2 AA compliance checks
 * - Normal text: minimum 4.5:1 contrast ratio
 * - Large text (18pt+ or 14pt+ bold): minimum 3:1 contrast ratio
 */

/**
 * Converts a hex color to RGB values
 * @param hex Color in hex format (e.g., '#FF0000' or 'FF0000')
 * @returns RGB object with r, g, b properties (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Converts RGB to hex color
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns Hex color string (e.g., '#FF0000')
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

/**
 * Calculates relative luminance of a color
 * Based on WCAG 2.2 formula
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns Luminance value (0-1)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  // Normalize RGB values to 0-1
  const [rs, gs, bs] = [r, g, b].map((val) => val / 255);

  // Apply gamma correction
  const [rLinear, gLinear, bLinear] = [rs, gs, bs].map((val) =>
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  );

  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates contrast ratio between two colors
 * Based on WCAG 2.2 formula: (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter color and L2 is the darker color
 * @param foreground Foreground color in hex format
 * @param background Background color in hex format
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(foreground: string, background: string): number {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    throw new Error('Invalid hex color format');
  }

  const fgLuminance = calculateLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgLuminance = calculateLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.2 AA compliance levels
 */
export interface ContrastCompliance {
  normalText: boolean;    // min 4.5:1
  largeText: boolean;     // min 3:1
  ratio: number;
}

/**
 * Checks if a color pair meets WCAG 2.2 AA standards
 * @param foreground Foreground color in hex format
 * @param background Background color in hex format
 * @returns Compliance object with results for normal and large text
 */
export function checkWCAG_AA_Compliance(
  foreground: string,
  background: string
): ContrastCompliance {
  const ratio = calculateContrastRatio(foreground, background);

  return {
    normalText: ratio >= 4.5,
    largeText: ratio >= 3,
    ratio: parseFloat(ratio.toFixed(2)),
  };
}

/**
 * Checks if a color pair meets WCAG 2.2 AAA standards (enhanced)
 * - Normal text: minimum 7:1 contrast ratio
 * - Large text: minimum 4.5:1 contrast ratio
 */
export interface ContrastComplianceAAA {
  normalText: boolean;    // min 7:1
  largeText: boolean;     // min 4.5:1
  ratio: number;
}

/**
 * Checks if a color pair meets WCAG 2.2 AAA standards
 * @param foreground Foreground color in hex format
 * @param background Background color in hex format
 * @returns Compliance object with results for normal and large text
 */
export function checkWCAG_AAA_Compliance(
  foreground: string,
  background: string
): ContrastComplianceAAA {
  const ratio = calculateContrastRatio(foreground, background);

  return {
    normalText: ratio >= 7,
    largeText: ratio >= 4.5,
    ratio: parseFloat(ratio.toFixed(2)),
  };
}

/**
 * Gets a summary of compliance status
 */
export function getComplianceSummary(compliance: ContrastCompliance): string {
  if (compliance.normalText) {
    return `✓ WCAG AA (${compliance.ratio}:1)`;
  } else if (compliance.largeText) {
    return `⚠ Large text only (${compliance.ratio}:1)`;
  }
  return `✗ No compliance (${compliance.ratio}:1)`;
}

/**
 * Suggestions for improving contrast
 */
export function getSuggestionsForImprovement(
  foreground: string,
  background: string
): string[] {
  const compliance = checkWCAG_AA_Compliance(foreground, background);
  const suggestions: string[] = [];

  if (!compliance.normalText) {
    suggestions.push('Consider making the foreground color darker or the background lighter');
    suggestions.push('For dark backgrounds, increase brightness of foreground color');
    suggestions.push('For light backgrounds, decrease brightness of foreground color');
  }

  return suggestions;
}

/**
 * Validates all color pairs in a component
 */
export interface ColorPairValidation {
  foreground: string;
  background: string;
  compliance: ContrastCompliance;
  compliant: boolean;
}

export function validateColorPairs(pairs: Array<{ fg: string; bg: string }>): ColorPairValidation[] {
  return pairs.map((pair) => {
    const compliance = checkWCAG_AA_Compliance(pair.fg, pair.bg);
    return {
      foreground: pair.fg,
      background: pair.bg,
      compliance,
      compliant: compliance.normalText,
    };
  });
}

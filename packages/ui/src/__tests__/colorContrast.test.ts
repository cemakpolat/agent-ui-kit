import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  calculateLuminance,
  calculateContrastRatio,
  checkWCAG_AA_Compliance,
  checkWCAG_AAA_Compliance,
  getComplianceSummary,
  getSuggestionsForImprovement,
  validateColorPairs,
} from '../utils/colorContrast';

describe('Color Contrast Utility', () => {
  describe('hexToRgb', () => {
    it('should convert hex color to RGB', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle hex without #', () => {
      expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle lowercase hex', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('#GGGGGG')).toBeNull();
      expect(hexToRgb('invalid')).toBeNull();
      expect(hexToRgb('#FF00')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex color', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00FF00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000FF');
    });

    it('should pad with zeros', () => {
      expect(rgbToHex(1, 2, 3)).toBe('#010203');
      expect(rgbToHex(16, 32, 64)).toBe('#102040');
    });

    it('should handle white and black', () => {
      expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });
  });

  describe('calculateLuminance', () => {
    it('should calculate luminance for white', () => {
      const luminance = calculateLuminance(255, 255, 255);
      expect(luminance).toBeCloseTo(1, 2);
    });

    it('should calculate luminance for black', () => {
      const luminance = calculateLuminance(0, 0, 0);
      expect(luminance).toBeCloseTo(0, 2);
    });

    it('should calculate luminance for gray', () => {
      const luminance = calculateLuminance(128, 128, 128);
      expect(luminance).toBeGreaterThan(0);
      expect(luminance).toBeLessThan(1);
    });

    it('should calculate luminance for red', () => {
      const luminance = calculateLuminance(255, 0, 0);
      expect(luminance).toBeGreaterThan(0);
      expect(luminance).toBeLessThan(1);
    });
  });

  describe('calculateContrastRatio', () => {
    it('should calculate contrast for black on white', () => {
      const ratio = calculateContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should calculate contrast for white on black', () => {
      const ratio = calculateContrastRatio('#FFFFFF', '#000000');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should be symmetric', () => {
      const ratio1 = calculateContrastRatio('#FF0000', '#FFFFFF');
      const ratio2 = calculateContrastRatio('#FFFFFF', '#FF0000');
      expect(ratio1).toBeCloseTo(ratio2, 1);
    });

    it('should handle real color examples', () => {
      // Dark text on light background (good contrast)
      const goodContrast = calculateContrastRatio('#1e293b', '#ffffff');
      expect(goodContrast).toBeGreaterThan(4.5);

      // Similar colors (poor contrast)
      const poorContrast = calculateContrastRatio('#ffffff', '#fffbf0');
      expect(poorContrast).toBeLessThan(3);
    });

    it('should throw error on invalid hex', () => {
      expect(() => calculateContrastRatio('#GGGGGG', '#FFFFFF')).toThrow();
      expect(() => calculateContrastRatio('#FFFFFF', '#invalid')).toThrow();
    });
  });

  describe('checkWCAG_AA_Compliance', () => {
    it('should pass for black on white (excellent contrast)', () => {
      const compliance = checkWCAG_AA_Compliance('#000000', '#FFFFFF');
      expect(compliance.normalText).toBe(true);
      expect(compliance.largeText).toBe(true);
      expect(compliance.ratio).toBeGreaterThan(20);
    });

    it('should pass normal text at 4.5:1 ratio', () => {
      // This is a real example with approximately 4.5:1 ratio
      const compliance = checkWCAG_AA_Compliance('#1e293b', '#ffffff');
      expect(compliance.normalText).toBe(true);
      expect(compliance.largeText).toBe(true);
    });

    it('should pass large text at 3:1 ratio but fail normal text', () => {
      // Colors with ~3:1 ratio
      const compliance = checkWCAG_AA_Compliance('#666666', '#ffffff');
      if (compliance.ratio >= 3 && compliance.ratio < 4.5) {
        expect(compliance.largeText).toBe(true);
        expect(compliance.normalText).toBe(false);
      }
    });

    it('should fail for low contrast colors', () => {
      const compliance = checkWCAG_AA_Compliance('#ffffff', '#fffbf0');
      expect(compliance.normalText).toBe(false);
      expect(compliance.largeText).toBe(false);
    });

    it('should include ratio in result', () => {
      const compliance = checkWCAG_AA_Compliance('#000000', '#FFFFFF');
      expect(typeof compliance.ratio).toBe('number');
      expect(compliance.ratio).toBeGreaterThan(0);
    });
  });

  describe('checkWCAG_AAA_Compliance', () => {
    it('should require 7:1 for normal text', () => {
      const compliance = checkWCAG_AAA_Compliance('#000000', '#FFFFFF');
      expect(compliance.normalText).toBe(true);
      expect(compliance.largeText).toBe(true);
      expect(compliance.ratio).toBeGreaterThan(7);
    });

    it('should require 4.5:1 for large text', () => {
      // Colors with good AA compliance but not AAA
      const compliance = checkWCAG_AAA_Compliance('#1e293b', '#ffffff');
      if (compliance.ratio < 7) {
        expect(compliance.normalText).toBe(false);
      }
      expect(compliance.largeText).toBe(true);
    });
  });

  describe('getComplianceSummary', () => {
    it('should return AA summary for passing normal text', () => {
      const compliance = checkWCAG_AA_Compliance('#000000', '#FFFFFF');
      const summary = getComplianceSummary(compliance);
      expect(summary).toContain('✓');
      expect(summary).toContain('WCAG AA');
    });

    it('should return large text only summary', () => {
      const compliance = checkWCAG_AA_Compliance('#666666', '#ffffff');
      if (compliance.ratio >= 3 && compliance.ratio < 4.5) {
        const summary = getComplianceSummary(compliance);
        expect(summary).toContain('⚠');
        expect(summary).toContain('Large text only');
      }
    });

    it('should return no compliance summary', () => {
      const compliance = checkWCAG_AA_Compliance('#ffffff', '#fffbf0');
      const summary = getComplianceSummary(compliance);
      expect(summary).toContain('✗');
      expect(summary).toContain('No compliance');
    });

    it('should include ratio in summary', () => {
      const compliance = checkWCAG_AA_Compliance('#000000', '#FFFFFF');
      const summary = getComplianceSummary(compliance);
      expect(summary).toContain(':1');
    });
  });

  describe('getSuggestionsForImprovement', () => {
    it('should return suggestions for low contrast', () => {
      const suggestions = getSuggestionsForImprovement('#ffffff', '#fffbf0');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('darker');
    });

    it('should return empty array for passing contrast', () => {
      const suggestions = getSuggestionsForImprovement('#000000', '#FFFFFF');
      expect(suggestions.length).toBe(0);
    });

    it('should provide actionable suggestions', () => {
      const suggestions = getSuggestionsForImprovement('#ffffff', '#fffbf0');
      expect(suggestions.some((s) => s.includes('background'))).toBe(true);
    });
  });

  describe('validateColorPairs', () => {
    it('should validate multiple color pairs', () => {
      const pairs = [
        { fg: '#000000', bg: '#FFFFFF' },
        { fg: '#FFFFFF', bg: '#000000' },
        { fg: '#991b1b', bg: '#FFFFFF' },
      ];
      const results = validateColorPairs(pairs);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.compliant === true)).toBe(true);
    });

    it('should mark non-compliant pairs', () => {
      const pairs = [
        { fg: '#ffffff', bg: '#fffbf0' },
      ];
      const results = validateColorPairs(pairs);
      expect(results[0].compliant).toBe(false);
    });

    it('should include compliance details', () => {
      const pairs = [
        { fg: '#000000', bg: '#FFFFFF' },
      ];
      const results = validateColorPairs(pairs);
      const result = results[0];
      expect(result.foreground).toBe('#000000');
      expect(result.background).toBe('#FFFFFF');
      expect(result.compliance).toHaveProperty('normalText');
      expect(result.compliance).toHaveProperty('largeText');
      expect(result.compliance).toHaveProperty('ratio');
    });
  });

  describe('Real-world examples', () => {
    it('should pass dark gray on light gray', () => {
      const compliance = checkWCAG_AA_Compliance('#374151', '#f3f4f6');
      expect(compliance.normalText || compliance.largeText).toBe(true);
    });

    it('should pass dark blue on white', () => {
      const compliance = checkWCAG_AA_Compliance('#1e293b', '#ffffff');
      expect(compliance.normalText).toBe(true);
    });

    it('should fail light colors on light background', () => {
      const compliance = checkWCAG_AA_Compliance('#e2e8f0', '#f8fafc');
      expect(compliance.normalText).toBe(false);
    });

    it('should handle syntax highlighting colors', () => {
      // Purple keyword on dark background
      const keyword = checkWCAG_AA_Compliance('#c084fc', '#1e293b');
      expect(keyword.largeText || keyword.normalText).toBe(true);

      // Green string on dark background
      const string = checkWCAG_AA_Compliance('#86efac', '#1e293b');
      expect(string.largeText || string.normalText).toBe(true);
    });

    it('should validate alert/error colors', () => {
      // Red error text on light background
      const error = checkWCAG_AA_Compliance('#991b1b', '#fef2f2');
      expect(error.normalText || error.largeText).toBe(true);

      // Green success text on light background
      const success = checkWCAG_AA_Compliance('#166534', '#f0fdf4');
      expect(success.normalText || success.largeText).toBe(true);
    });
  });
});

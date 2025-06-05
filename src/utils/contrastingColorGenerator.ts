interface HSVColor {
  h: number; // Hue: 0-1
  s: number; // Saturation: 0-1
  v: number; // Value: 0-1
}

interface RGBColor {
  r: number; // Red: 0-255
  g: number; // Green: 0-255
  b: number; // Blue: 0-255
}

interface ContrastingColorResult {
  rgbString: string;
  rgb: RGBColor;
  hsv: HSVColor;
  hue: number;
  hex: string;
  index: number;
}

interface ColorGeneratorOptions {
  saturationRange?: [number, number]; // Default: [0.7, 1.0]
  valueRange?: [number, number]; // Default: [0.6, 1.0]
  startHue?: number; // Default: random
  goldenRatio?: boolean; // Default: true (uses golden angle)
}

/**
 * A generator class that yields sequences of contrasting colors that "pop out" from each other.
 * Uses the golden angle for optimal color distribution and HSV color space for vibrant results.
 */
export class ContrastingColorGenerator {
  private currentHue: number;
  private colorIndex: number = 0;
  private readonly goldenAngleConjugate = 0.61803398875;
  private readonly options: Required<ColorGeneratorOptions>;

  constructor(options: ColorGeneratorOptions = {}) {
    this.options = {
      saturationRange: options.saturationRange || [0.7, 1.0],
      valueRange: options.valueRange || [0.6, 1.0],
      startHue: options.startHue ?? Math.random(),
      goldenRatio: options.goldenRatio ?? true,
    };

    this.currentHue = this.options.startHue;
  }

  /**
   * Generator function that yields infinite sequence of contrasting colors
   */
  *generate(): Generator<ContrastingColorResult, never, unknown> {
    while (true) {
      const color = this.generateNextColor();
      yield color;
    }
  }

  /**
   * Generator function that yields a specific number of contrasting colors
   */
  *generateSequence(count: number): Generator<ContrastingColorResult, void, unknown> {
    for (let i = 0; i < count; i++) {
      yield this.generateNextColor();
    }
  }

  /**
   * Generator function that yields colors until a condition is met
   */
  *generateUntil(
    predicate: (color: ContrastingColorResult) => boolean
  ): Generator<ContrastingColorResult, void, unknown> {
    let color: ContrastingColorResult;
    do {
      color = this.generateNextColor();
      yield color;
    } while (!predicate(color));
  }

  /**
   * Get the next color in the sequence (non-generator method)
   */
  next(): ContrastingColorResult {
    return this.generateNextColor();
  }

  /**
   * Get a specific number of colors as an array
   */
  getSequence(count: number): ContrastingColorResult[] {
    return Array.from(this.generateSequence(count));
  }

  /**
   * Reset the generator to start over
   */
  reset(newStartHue?: number): void {
    this.currentHue = newStartHue ?? this.options.startHue;
    this.colorIndex = 0;
  }

  /**
   * Skip to a specific index in the sequence
   */
  skipTo(index: number): ContrastingColorResult {
    this.reset();
    let color: ContrastingColorResult;
    for (let i = 0; i <= index; i++) {
      color = this.generateNextColor();
    }
    return color!;
  }

  /**
   * Create a new generator with different options
   */
  fork(newOptions: ColorGeneratorOptions = {}): ContrastingColorGenerator {
    const mergedOptions = { ...this.options, ...newOptions };
    return new ContrastingColorGenerator(mergedOptions);
  }

  /**
   * Get current state information
   */
  getState() {
    return {
      currentHue: this.currentHue,
      colorIndex: this.colorIndex,
      options: { ...this.options },
    };
  }

  /**
   * Generate the next color in the sequence
   */
  private generateNextColor(): ContrastingColorResult {
    // Calculate next hue using golden angle or simple increment
    if (this.options.goldenRatio && this.colorIndex > 0) {
      this.currentHue = (this.currentHue + this.goldenAngleConjugate) % 1;
    } else if (!this.options.goldenRatio && this.colorIndex > 0) {
      // Simple uniform distribution
      this.currentHue = (this.currentHue + 0.2) % 1;
    }

    // Generate random saturation and value within specified ranges
    const [minSat, maxSat] = this.options.saturationRange;
    const [minVal, maxVal] = this.options.valueRange;

    const saturation = minSat + Math.random() * (maxSat - minSat);
    const value = minVal + Math.random() * (maxVal - minVal);

    const hsv: HSVColor = {
      h: this.currentHue,
      s: saturation,
      v: value,
    };

    const rgb = this.hsvToRgb(hsv.h, hsv.s, hsv.v);
    const hex = this.rgbToHex(rgb);

    const result: ContrastingColorResult = {
      rgbString: this.rgbToString(rgb),
      rgb,
      hsv,
      hue: this.currentHue,
      hex,
      index: this.colorIndex,
    };

    this.colorIndex++;
    return result;
  }

  /**
   * Convert HSV to RGB
   */
  private hsvToRgb(h: number, s: number, v: number): RGBColor {
    let r: number, g: number, b: number;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
        break;
      default:
        r = 0;
        g = 0;
        b = 0;
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  /**
   * Convert RGB to CSS string
   */
  private rgbToString(color: RGBColor): string {
    return `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Convert RGB to hex string
   */
  private rgbToHex(color: RGBColor): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }

  /**
   * Static method to create preset generators
   */
  static createPreset(preset: 'vibrant' | 'pastel' | 'dark' | 'neon'): ContrastingColorGenerator {
    const presets: Record<string, ColorGeneratorOptions> = {
      vibrant: {
        saturationRange: [0.8, 1.0],
        valueRange: [0.7, 1.0],
      },
      pastel: {
        saturationRange: [0.3, 0.6],
        valueRange: [0.8, 1.0],
      },
      dark: {
        saturationRange: [0.6, 0.9],
        valueRange: [0.3, 0.6],
      },
      neon: {
        saturationRange: [0.9, 1.0],
        valueRange: [0.9, 1.0],
      },
    };

    return new ContrastingColorGenerator(presets[preset]);
  }
}

// Export singleton instances for convenience
export const vibrantColors = ContrastingColorGenerator.createPreset('vibrant');
export const pastelColors = ContrastingColorGenerator.createPreset('pastel');
export const darkColors = ContrastingColorGenerator.createPreset('dark');
export const neonColors = ContrastingColorGenerator.createPreset('neon');

// Example usage:
/*
// Basic usage with generator
const colorGen = new ContrastingColorGenerator();

// Get colors using generator (infinite sequence)
const generator = colorGen.generate();
const color1 = generator.next().value;
const color2 = generator.next().value;
const color3 = generator.next().value;

// Get specific number of colors
const fiveColors = colorGen.getSequence(5);

// Use preset generators
const vibrantGenerator = ContrastingColorGenerator.createPreset('vibrant');
const vibrantColors = vibrantGenerator.getSequence(3);

// Custom options
const customGen = new ContrastingColorGenerator({
  saturationRange: [0.5, 0.8],
  valueRange: [0.4, 0.7],
  startHue: 0.3, // Start with green-ish
});

// Generate until condition
const genUntilRed = customGen.generateUntil(color => color.hue > 0.9 || color.hue < 0.1);
const redishColors = Array.from(genUntilRed);

// Use with for...of
for (const color of colorGen.generateSequence(5)) {
  console.log(`Color ${color.index}: ${color.hex}`);
}
*/

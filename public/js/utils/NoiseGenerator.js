/**
 * Simple 2D noise generator for terrain generation
 */
class NoiseGenerator {
  constructor(seed = Math.random()) {
    this.seed = seed;
    this.permutation = this.generatePermutation();
  }

  // Generate a deterministic permutation table based on seed
  generatePermutation() {
    const p = new Array(512);
    const random = this.mulberry32(this.seed);

    // Generate values 0-255
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle array
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Copy to double array for wrap-around
    for (let i = 0; i < 256; i++) {
      p[i + 256] = p[i];
    }

    return p;
  }

  // Simple seeded random number generator
  mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Get gradient from hash value
  gradient(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  // Linear interpolation
  lerp(a, b, t) {
    return a + t * (b - a);
  }

  // Fade function for smoother transitions
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  // Get noise value at coordinates
  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const p = this.permutation;
    const A = p[X] + Y;
    const B = p[X + 1] + Y;

    // Hash coordinates of the 4 corners
    const aa = p[A];
    const ab = p[A + 1];
    const ba = p[B];
    const bb = p[B + 1];

    // Get the gradients and dot product with distance vectors
    const g1 = this.gradient(p[aa], xf, yf);
    const g2 = this.gradient(p[ba], xf - 1, yf);
    const g3 = this.gradient(p[ab], xf, yf - 1);
    const g4 = this.gradient(p[bb], xf - 1, yf - 1);

    // Interpolate the results
    const x1 = this.lerp(g1, g2, u);
    const x2 = this.lerp(g3, g4, u);

    // Return a value in range [-1, 1]
    return this.lerp(x1, x2, v);
  }

  // Get fractal noise (multiple octaves of noise)
  fractalNoise(x, y, octaves = 4, persistence = 0.5) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    // Return a normalized value between 0 and 1
    return (total / maxValue + 1) / 2;
  }

  // Add this method to NoiseGenerator.js
  createPeaks(x, y, peakPoints, peakHeight = 2.0, peakWidth = 5.0) {
    // Calculate distance to closest peak
    let closestDistance = Infinity;

    for (const peak of peakPoints) {
      const dx = x - peak.x;
      const dy = y - peak.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      closestDistance = Math.min(closestDistance, distance);
    }

    // Apply bell curve falloff
    if (closestDistance < peakWidth) {
      // Smoother falloff with squared distance
      const falloff = 1 - (closestDistance * closestDistance) / (peakWidth * peakWidth);
      return peakHeight * falloff;
    }

    return 0; // No effect when far from peaks
  }
}

export { NoiseGenerator };
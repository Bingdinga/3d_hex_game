/**
 * Utility functions for hexagonal grid calculations
 * Using axial coordinate system (q,r)
 */
class HexUtils {
  constructor(size = 1) {
    this.size = size;
  }

  /**
   * Get the six corners of a hexagon at given coordinates
   * @param {number} q - q coordinate (axial)
   * @param {number} r - r coordinate (axial)
   * @returns {Array} Array of Vector3 positions for the corners
   */
  getHexCorners(q, r) {
    const corners = [];
    const center = this.axialToPixel(q, r);

    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i;
      const x = center.x + this.size * Math.cos(angle);
      const z = center.z + this.size * Math.sin(angle);
      corners.push(new THREE.Vector3(x, 0, z));
    }

    return corners;
  }

  /**
   * Convert axial coordinates to pixel (3D) coordinates
   * @param {number} q - q coordinate (axial)
   * @param {number} r - r coordinate (axial)
   * @returns {THREE.Vector3} 3D position
   */
  axialToPixel(q, r) {
    const x = this.size * (3 / 2 * q);
    const z = this.size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return new THREE.Vector3(x, 0, -z); // added -1 for some reason, conversion quirk
  }

  /**
* Get the correct 3D world position for an object above a hex
* @param {number} q - q coordinate (axial)
* @param {number} r - r coordinate (axial)
* @param {number} height - height above the grid
* @returns {THREE.Vector3} Corrected 3D position
*/
  getObjectPosition(q, r, height = 0) {
    const pos = this.axialToPixel(q, r);
    return new THREE.Vector3(pos.x, height, -pos.z); // Negate z here
  }

  /**
   * Convert pixel coordinates to axial coordinates
   * @param {number} x - x position
   * @param {number} z - z position
   * @returns {Object} Axial coordinates {q, r}
   */
  pixelToAxial(x, z) {
    const q = (2 / 3 * x) / this.size;
    const r = (-1 / 3 * x + Math.sqrt(3) / 3 * z) / this.size;

    // Round to nearest hex
    return this.roundAxial(q, r);
  }

  /**
   * Round floating point axial coordinates to the nearest hex
   * @param {number} q - q coordinate (axial)
   * @param {number} r - r coordinate (axial)
   * @returns {Object} Rounded axial coordinates {q, r}
   */
  roundAxial(q, r) {
    let s = -q - r;

    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  }

  /**
   * Get all hexagons within a certain radius
   * @param {number} centerQ - Center q coordinate
   * @param {number} centerR - Center r coordinate
   * @param {number} radius - Radius (in hex units)
   * @returns {Array} Array of {q, r} objects
   */
  getHexesInRadius(centerQ, centerR, radius) {
    const results = [];

    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);

      for (let r = r1; r <= r2; r++) {
        results.push({ q: centerQ + q, r: centerR + r });
      }
    }

    return results;
  }

  /**
   * Get a unique ID for a hex based on its coordinates
   * @param {number} q - q coordinate
   * @param {number} r - r coordinate
   * @returns {string} Unique ID
   */
  getHexId(q, r) {
    return `${q},${r}`;
  }

  /**
   * Parse a hex ID back into coordinates
   * @param {string} id - Hex ID
   * @returns {Object} Coordinates {q, r}
   */
  parseHexId(id) {
    const [q, r] = id.split(',').map(Number);
    return { q, r };
  }
}

export { HexUtils };
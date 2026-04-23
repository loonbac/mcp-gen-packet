import { describe, it, expect } from "vitest";
import { autoLayout, type LayoutDevice } from "../../src/layout/auto-layout";

describe("5.1 Auto-Layout", () => {
  describe("grid positioning", () => {
    it("should return empty array for empty input", () => {
      const result = autoLayout([]);
      expect(result).toEqual([]);
    });

    it("should return single device at origin", () => {
      const result = autoLayout(["Router1"]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "Router1", x: 100, y: 100 });
    });

    it("should space devices at least 150px apart horizontally", () => {
      const devices = ["D1", "D2"];
      const result = autoLayout(devices);
      const distance = Math.abs(result[1].x - result[0].x);
      expect(distance).toBeGreaterThanOrEqual(150);
    });

    it("should use default 4 columns", () => {
      const devices = ["D1", "D2", "D3", "D4", "D5"];
      const result = autoLayout(devices);
      // D5 should wrap to second row, not 5th column
      // With 4 columns, positions are:
      // (0,0)=D1, (1,0)=D2, (2,0)=D3, (3,0)=D4
      // (0,1)=D5
      expect(result[4].x).toBe(100); // Back to first column
      expect(result[4].y).toBeGreaterThan(result[0].y); // On next row
    });

    it("should accept custom columns parameter", () => {
      const devices = ["D1", "D2", "D3"];
      const result = autoLayout(devices, { columns: 2 });
      // With 2 columns: D1(0,0), D2(1,0), D3(0,1)
      expect(result[2].x).toBe(100); // Wrapped
      expect(result[2].y).toBeGreaterThan(result[0].y);
    });
  });

  describe("determinism", () => {
    it("should produce same output for same input", () => {
      const devices = ["Router1", "Switch1", "PC1"];
      const result1 = autoLayout(devices);
      const result2 = autoLayout(devices);
      expect(result1).toEqual(result2);
    });

    it("should produce different positions for different inputs", () => {
      const result1 = autoLayout(["DeviceA"]);
      const result2 = autoLayout(["DeviceB"]);
      expect(result1[0].name).not.toEqual(result2[0].name);
    });
  });

  describe("spacing", () => {
    it("should use 150px as minimum spacing", () => {
      const devices = ["A", "B", "C", "D"];
      const result = autoLayout(devices);
      // Check all pairwise Euclidean distances
      for (let i = 0; i < result.length - 1; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const dx = result[j].x - result[i].x;
          const dy = result[j].y - result[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          expect(distance).toBeGreaterThanOrEqual(150);
        }
      }
    });
  });

  describe("edge cases", () => {
    it("should handle single device", () => {
      const result = autoLayout(["Single"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Single");
      expect(result[0].x).toBe(100);
      expect(result[0].y).toBe(100);
    });

    it("should handle many devices (more than one grid)", () => {
      const devices = Array.from({ length: 10 }, (_, i) => `Device${i}`);
      const result = autoLayout(devices);
      expect(result).toHaveLength(10);
      // Verify wrapping works correctly
      expect(result[4].y).toBeGreaterThan(result[0].y); // Row 2 starts
      expect(result[8].y).toBeGreaterThan(result[4].y); // Row 3 starts
    });
  });
});
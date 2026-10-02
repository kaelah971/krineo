import { describe, expect, it } from "vitest";
import { clearanceSlot, heroSlots, heroTiming, phoneTransform } from "../components/krineo/marketing/hero-motion";

describe("marketing carousel geometry", () => {
  it.each([
    [1440, 460, 420, 184, 152, 12], [1024, 440, 392, 172, 144, 12],
    [768, 400, 366, 160, 132, 12], [390, 350, 316, 136, 112, 12], [320, 280, 288, 124, 104, 8],
  ])("keeps every slot and front emphasis inside the stage at %ipx", (_viewport, stage, height, front, rear, inset) => {
    const slots = heroSlots(stage, front, rear, inset);
    for (const slot of slots) {
      expect(slot.center - slot.width / 2).toBeGreaterThanOrEqual(0);
      expect(slot.center + slot.width / 2).toBeLessThanOrEqual(stage);
      expect(slot.top + slot.width * 2.13).toBeLessThanOrEqual(height);
    }
    expect(slots[0].top - 6 + front * 1.035 * 2.13).toBeLessThanOrEqual(height);
    const clearing = clearanceSlot(slots[0], slots[1], slots[2]);
    expect(clearing.center - clearing.width / 2).toBeGreaterThan(slots[1].center + rear / 2);
    expect(clearing.center + clearing.width / 2).toBeLessThanOrEqual(stage);
  });

  it("uses translation and scale without turning screens away", () => {
    expect(phoneTransform({ width: 152, left: 12, top: 30 }, heroSlots(460, 184, 152, 12)[0]))
      .toBe("translate(142px, -18px) scale(1.2105263157894737)");
  });

  it("allows a calm inspection cadence before each advance", () => {
    expect(heroTiming.rest + heroTiming.pop + heroTiming.advance).toBe(3800);
    expect(heroTiming.startDelay).toBe(1000);
    expect(heroTiming.clearance).toBeLessThan(heroTiming.advance);
  });
});

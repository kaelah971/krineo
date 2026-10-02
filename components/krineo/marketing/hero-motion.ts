export const heroTiming = { entrance: 650, startDelay: 1000, rest: 2700, pop: 300, advance: 800, clearance: 180 } as const;
export type PhoneGeometry = { width: number; left: number; top: number };
export type PhoneSlot = { center: number; top: number; width: number; opacity: number };

export function heroSlots(stageWidth: number, frontWidth: number, rearWidth: number, inset: number): PhoneSlot[] {
  return [
    { center: stageWidth / 2, top: 12, width: frontWidth, opacity: 1 },
    { center: inset + rearWidth / 2, top: 30, width: rearWidth, opacity: .8 },
    { center: stageWidth - inset - rearWidth / 2, top: 30, width: rearWidth, opacity: .8 },
  ];
}

export function phoneTransform(phone: PhoneGeometry, slot: PhoneSlot, emphasis = false) {
  const scale = slot.width / phone.width * (emphasis ? 1.035 : 1);
  return `translate(${slot.center - phone.left - phone.width / 2}px, ${slot.top - phone.top - (emphasis ? 6 : 0)}px) scale(${scale})`;
}

// Clear the incoming silhouette before promoting its paint layer.
export function clearanceSlot(front: PhoneSlot, left: PhoneSlot, right: PhoneSlot): PhoneSlot {
  const clearance = Math.max(0, (front.width * 1.035 + left.width) / 2 - (front.center - left.center) + 8);
  return { ...front, center: front.center + Math.min(right.center - front.center, clearance) };
}

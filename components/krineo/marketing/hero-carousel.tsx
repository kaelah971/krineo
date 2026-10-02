"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { clearanceSlot, heroSlots, heroTiming, phoneTransform, type PhoneGeometry } from "./hero-motion";
import styles from "./landing.module.css";

const ease = "cubic-bezier(.22,1,.36,1)";

export function HeroCarousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage || !stage.animate) return;
    // DOM order remains portfolio, receipt, research; cycle order is A, B, C.
    const frames = [...stage.querySelectorAll<HTMLElement>("[data-phone]")];
    const phones = [frames[0], frames[2], frames[1]];
    const copy = stage.closest("section")?.querySelector<HTMLElement>(`.${styles.heroCopy}`);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const animations = new Set<Animation>();
    let generation = 0, front = 0, signature = "", entered = false;
    let hovering = false, interacting = false, focused = false, visible = true;

    const pause = () => {
      const paused = document.hidden || !visible || hovering || interacting || focused;
      stage.dataset.carouselPaused = String(paused);
      animations.forEach(animation => { if (paused) animation.pause(); else animation.play(); });
    };
    const play = (element: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = element.animate(keyframes, { fill: "forwards", ...options });
      animations.add(animation); pause(); return animation;
    };
    const finish = async (animation: Animation, persist = true) => {
      await animation.finished;
      if (persist) animation.commitStyles();
      animations.delete(animation); animation.cancel();
    };
    const delay = (duration: number) => finish(play(stage, [], { duration }), false);
    const cancel = () => {
      generation++;
      animations.forEach(animation => animation.cancel());
      animations.clear();
    };
    const reset = () => {
      [...phones, ...(copy ? [copy] : [])].forEach(element => {
        ["transform", "opacity", "z-index", "transform-origin", "will-change"].forEach(property => element.style.removeProperty(property));
      });
      delete stage.dataset.carouselFront;
      delete stage.dataset.carouselPhase;
      delete stage.dataset.carouselPaused;
    };
    const start = () => {
      cancel();
      if (preference.matches) { reset(); return; }
      const run = generation;
      // Read geometry once at initialization/resize, never in the motion loop.
      const geometry: PhoneGeometry[] = phones.map(phone => ({ width: phone.offsetWidth, left: phone.offsetLeft, top: phone.offsetTop }));
      const slots = heroSlots(stage.clientWidth, geometry[1].width, geometry[0].width, geometry[0].left);
      phones.forEach(phone => { phone.style.transformOrigin = "center top"; phone.style.willChange = "transform, opacity"; });
      const slotFor = (index: number) => (index - front + 3) % 3;
      const settle = () => phones.forEach((phone, index) => {
        const slot = slotFor(index);
        phone.style.transform = phoneTransform(geometry[index], slots[slot]);
        phone.style.opacity = String(slots[slot].opacity);
        phone.style.zIndex = slot === 0 ? "3" : "1";
      });
      settle();
      stage.dataset.carouselFront = ["portfolio", "research", "receipt"][front];
      const cycle = async () => {
        if (!entered) {
          stage.dataset.carouselPhase = "entrance";
          const text = copy ? finish(play(copy, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 440, easing: ease })) : Promise.resolve();
          await Promise.all([text, ...phones.map((phone, index) => {
            const target = slots[slotFor(index)];
            return finish(play(phone, [{ opacity: 0, transform: phoneTransform(geometry[index], { ...target, top: target.top + 8 }) }, { opacity: target.opacity, transform: phoneTransform(geometry[index], target) }], { duration: heroTiming.entrance, delay: 160, easing: ease }));
          })]);
          entered = true;
          stage.dataset.carouselPhase = "settled";
          await delay(heroTiming.startDelay);
        }
        while (run === generation) {
          stage.dataset.carouselPhase = "rest";
          await delay(heroTiming.rest);
          stage.dataset.carouselPhase = "pop";
          await finish(play(phones[front], [{ transform: phoneTransform(geometry[front], slots[0]) }, { transform: phoneTransform(geometry[front], slots[0], true) }], { duration: heroTiming.pop, easing: ease }));
          stage.dataset.carouselPhase = "advance";
          const incoming = (front + 1) % 3, rear = (front + 2) % 3;
          phones[rear].style.zIndex = "1";
          phones[incoming].style.zIndex = "2";
          const clearance = clearanceSlot(slots[0], slots[1], slots[2]);
          const outgoingAnimation = finish(play(phones[front], [
            { transform: phoneTransform(geometry[front], slots[0], true), opacity: 1, offset: 0, easing: "cubic-bezier(.4,0,1,1)" },
            { transform: phoneTransform(geometry[front], clearance), opacity: 1, offset: heroTiming.clearance / heroTiming.advance, easing: ease },
            { transform: phoneTransform(geometry[front], slots[2]), opacity: slots[2].opacity, offset: 1 },
          ], { duration: heroTiming.advance }));
          const incomingAnimation = (async () => {
            await delay(heroTiming.clearance);
            // Promote while still in the clear rear slot, then advance. Even a
            // busy main thread cannot promote an already-overlapping silhouette.
            phones[incoming].style.zIndex = "4";
            await finish(play(phones[incoming], [
              { transform: phoneTransform(geometry[incoming], slots[1]), opacity: slots[1].opacity },
              { transform: phoneTransform(geometry[incoming], slots[0]), opacity: 1 },
            ], { duration: heroTiming.advance - heroTiming.clearance, easing: ease }));
          })();
          const rearAnimation = finish(play(phones[rear], [
            { transform: phoneTransform(geometry[rear], slots[2]), opacity: slots[2].opacity },
            { transform: phoneTransform(geometry[rear], slots[1]), opacity: slots[1].opacity },
          ], { duration: heroTiming.advance, easing: ease }));
          await Promise.all([outgoingAnimation, incomingAnimation, rearAnimation]);
          front = incoming; settle();
          stage.dataset.carouselFront = ["portfolio", "research", "receipt"][front];
        }
      };
      // Cancellation is expected on resize, preference changes and unmount.
      void cycle().catch(error => { if (run === generation && error?.name !== "AbortError") console.error(error); });
    };
    const enter = () => { hovering = hover.matches; pause(); };
    const leave = () => { hovering = false; pause(); };
    const press = () => { interacting = true; pause(); };
    const release = () => { interacting = false; pause(); };
    const focus = () => { focused = true; pause(); };
    const blur = (event: FocusEvent) => { focused = event.relatedTarget instanceof Node && stage.contains(event.relatedTarget); pause(); };
    stage.addEventListener("pointerenter", enter);
    stage.addEventListener("pointerleave", leave);
    stage.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    stage.addEventListener("focusin", focus);
    stage.addEventListener("focusout", blur);
    document.addEventListener("visibilitychange", pause);
    preference.addEventListener("change", start);
    const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; pause(); });
    visibility.observe(stage);
    const resize = new ResizeObserver(() => {
      const next = `${stage.clientWidth}:${phones.map(phone => phone.offsetWidth).join(":")}`;
      if (signature !== next) { signature = next; start(); }
    });
    resize.observe(stage);
    return () => {
      cancel(); reset(); resize.disconnect(); visibility.disconnect();
      stage.removeEventListener("pointerenter", enter);
      stage.removeEventListener("pointerleave", leave);
      stage.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      stage.removeEventListener("focusin", focus);
      stage.removeEventListener("focusout", blur);
      document.removeEventListener("visibilitychange", pause);
      preference.removeEventListener("change", start);
    };
  }, []);

  return <div ref={ref} className={styles.phoneStage} data-hero-phones="true">{children}</div>;
}

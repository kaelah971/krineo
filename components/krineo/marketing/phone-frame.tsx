import type { ReactNode } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import styles from "./landing.module.css";

export function PhoneStatusBar() {
  return <div className={styles.statusBar} aria-hidden="true"><span>9:41</span><div><Signal /><Wifi /><BatteryFull /></div></div>;
}

export function PhoneFrame({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return <div className={`${styles.phone} ${className}`} data-phone="true" role="img" aria-label={label}>
    <div className={styles.phoneEdge} aria-hidden="true" />
    <div className={styles.phoneScreen} aria-hidden="true">
      <span className={styles.island} />
      <PhoneStatusBar />
      {children}
      <span className={styles.homeIndicator} />
    </div>
  </div>;
}

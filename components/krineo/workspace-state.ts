"use client";

import { useSyncExternalStore } from "react";
import {
  getServerWorkspaceSnapshot,
  getWorkspaceSnapshot,
  subscribeWorkspace,
  type WorkspaceState,
} from "@/lib/workspace/store";

export function useWorkspaceState(): WorkspaceState | null | undefined {
  return useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceSnapshot,
    getServerWorkspaceSnapshot,
  );
}

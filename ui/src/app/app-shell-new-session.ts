import { readSessionMethodAccess } from "../lib/session-method-access.ts";
import type { ShellChromeHost } from "./app-shell-chrome.ts";

/** Native startup may queue navigation; a keyboard action belongs to the ready surface only. */
export function openShellNewSession(host: ShellChromeHost, source: "native" | "shortcut"): boolean {
  const context = host.context;
  if (
    host.onboardingMode ||
    (source === "shortcut" &&
      (document.openClawModalLayers?.size ||
        document.querySelector(".shell-nav[aria-modal='true']")))
  ) {
    return false;
  }
  if (!context) {
    if (source === "native") {
      host.pendingNativeNewSession = true;
      return true;
    }
    return false;
  }
  if (
    !readSessionMethodAccess(context.gateway.snapshot, { method: "sessions.create", params: {} })
      .allowed
  ) {
    return false;
  }
  host.openNewSession(context.agentSelection.state.selectedId ?? "");
  if (source === "shortcut") {
    host
      .querySelector<HTMLElement & { focusComposer(): void }>("openclaw-new-session-page")
      ?.focusComposer();
  }
  return true;
}

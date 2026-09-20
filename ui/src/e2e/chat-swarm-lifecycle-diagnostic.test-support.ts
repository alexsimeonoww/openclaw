import { asNullableRecord } from "@openclaw/normalization-core/record-coerce";
import type { Page } from "playwright";
import type { ApplicationContext } from "../app/context.ts";
import type { SwarmRosterHydrator } from "../lib/sessions/swarm-roster.ts";
import type { MockGatewayControls } from "../test-helpers/control-ui-e2e.ts";

export type SwarmDiagnosticPane = HTMLElement & {
  state?: { sessionKey: string; connectionEpoch: number; lastError: string | null };
  swarmHydrator?: SwarmRosterHydrator;
};
export type SwarmDiagnosticWindow = Window & {
  openclawSwarmDiagnostic?: {
    events: Record<string, unknown>[];
    expandedDetails?: Element | null;
    expandedEpoch?: number;
  };
};

export async function installSwarmDiagnostic(page: Page, parentKey: string) {
  await page.evaluate((key) => {
    const events: Record<string, unknown>[] = [];
    (window as SwarmDiagnosticWindow).openclawSwarmDiagnostic = { events };
    const record = (entry: Record<string, unknown>) => {
      if (events.length === 40) {
        events.shift();
      }
      events.push({ at: Math.round(performance.now()), ...entry });
    };
    // This callback runs in the browser realm, inspecting only mock protocol fields.
    const object = (value: unknown): Record<string, unknown> | null =>
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    // oxlint-disable-next-line typescript/unbound-method -- Delegation below preserves the socket receiver with call().
    const dispatch = WebSocket.prototype.dispatchEvent;
    WebSocket.prototype.dispatchEvent = function (event) {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        const decoded: unknown = JSON.parse(event.data);
        const frame = object(decoded);
        const payload = object(frame?.payload);
        const rows: unknown[] | null = Array.isArray(payload?.sessions) ? payload.sessions : null;
        const described = object(payload?.session);
        const parent =
          described?.key === key ? described : rows?.map(object).find((row) => row?.key === key);
        if (frame?.type === "event") {
          record({ kind: "event", event: frame.event, seq: frame.seq });
        } else if (frame?.type === "res" && (parent || rows)) {
          record({
            kind: "response",
            id: frame.id,
            method: rows ? "sessions.list" : "sessions.describe",
            count: rows?.length,
            status: parent?.status,
            hasActiveRun: parent?.hasActiveRun,
            updatedAt: parent?.updatedAt,
          });
        }
      } else if (["open", "close", "error"].includes(event.type)) {
        record({ kind: "socket", event: event.type });
      }
      return dispatch.call(this, event);
    };
  }, parentKey);
}

export async function logSwarmDiagnostic(
  page: Page,
  gateway: MockGatewayControls,
  parentKey: string,
) {
  const state = await page.evaluate((key) => {
    const pane = document.querySelector<SwarmDiagnosticPane>(
      "openclaw-chat-pane.chat-pane-cache__pane--active",
    );
    const app = document.querySelector("openclaw-app") as
      | (HTMLElement & { runtime?: { context?: ApplicationContext } })
      | null;
    const snapshot = app?.runtime?.context?.gateway.snapshot;
    const parent = pane?.swarmHydrator?.rows.find((row) => row.key === key);
    const widget = document.querySelector('[data-test-id="chat-swarm"]');
    const details = widget?.querySelector("details");
    const diagnostic = (window as SwarmDiagnosticWindow).openclawSwarmDiagnostic;
    return {
      sessionKey: pane?.state?.sessionKey,
      connectionEpoch: pane?.state?.connectionEpoch,
      expandedEpoch: diagnostic?.expandedEpoch,
      gatewayPhase: snapshot?.phase,
      lastErrorPresent: Boolean(snapshot?.lastError || pane?.state?.lastError),
      parent: parent && {
        status: parent.status,
        hasActiveRun: parent.hasActiveRun,
        updatedAt: parent.updatedAt,
      },
      detailsOpen: details?.open,
      detailsSame: details === diagnostic?.expandedDetails,
      outcome: widget?.querySelector(".chat-swarm__outcome")?.textContent?.trim(),
      events: diagnostic?.events,
    };
  }, parentKey);
  const requests = (await gateway.getRequests())
    .filter((request) => ["sessions.describe", "sessions.list"].includes(request.method))
    .slice(-30)
    .map(({ id, method, params }) => {
      const query = asNullableRecord(params);
      return { id, method, key: query?.key, spawnedBy: query?.spawnedBy, limit: query?.limit };
    });
  console.info("[swarm-final-diagnostic] " + JSON.stringify({ ...state, requests }));
}

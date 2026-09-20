import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { upsertSessionEntry } from "openclaw/plugin-sdk/session-store-runtime";
import { closeOpenClawAgentDatabasesAsync } from "openclaw/plugin-sdk/sqlite-runtime-testing";

export function createCodexTranscriptMirrorFixture() {
  const tempDirs: string[] = [];

  async function makeRoot(prefix: string): Promise<string> {
    // openclaw-temp-dir: allow async SQLite disposal must precede removal without retries.
    const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(root);
    return root;
  }

  async function createTarget(prefix: string, options: { sessionId?: string } = {}) {
    const root = await makeRoot(prefix);
    const agentId = "main";
    const sessionId = options.sessionId ?? "session-1";
    const sessionKey = `agent:${agentId}:${sessionId}`;
    const storePath = path.join(root, "openclaw-agent.sqlite");
    await upsertSessionEntry({
      agentId,
      sessionKey,
      storePath,
      entry: {
        sessionFile: `sqlite:${agentId}:${sessionId}:${storePath}`,
        sessionId,
        updatedAt: 1,
      },
    });
    return {
      agentId,
      sessionId,
      sessionKey,
      storePath,
      bogusSessionFile: path.join(root, "should-not-be-created.jsonl"),
    };
  }

  async function cleanup(): Promise<void> {
    for (const dir of tempDirs.splice(0)) {
      await closeOpenClawAgentDatabasesAsync(dir);
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  return { makeRoot, createTarget, cleanup };
}

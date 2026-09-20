import {
  isSubagentCoordinationInputProvenance,
  normalizeInputProvenance,
  type InputProvenance,
} from "../../sessions/input-provenance.js";
import type { AgentMessage } from "../runtime/index.js";

/**
 * Keep internal messages in the audit/model transcript without
 * projecting them into user-facing chat history.
 */
export function projectAgentHarnessTranscriptMessageForDisplay<T extends AgentMessage>(params: {
  hidden: boolean;
  inputProvenance?: InputProvenance;
  message: T;
  sourceMessage?: AgentMessage;
}): T {
  const inputProvenance =
    params.message.role === "user"
      ? (normalizeInputProvenance(Reflect.get(params.message, "provenance")) ??
        params.inputProvenance)
      : params.inputProvenance;
  const sourceHidden =
    params.sourceMessage !== undefined && Reflect.get(params.sourceMessage, "display") === false;
  if (!params.hidden && !sourceHidden && !isSubagentCoordinationInputProvenance(inputProvenance)) {
    return params.message;
  }
  if (Reflect.get(params.message, "display") === false) {
    return params.message;
  }
  return Object.assign({}, params.message, { display: false });
}

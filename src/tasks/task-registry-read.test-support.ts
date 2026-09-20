import { vi } from "vitest";
import {
  createGatewayMethodRegistry,
  createCoreGatewayMethodDescriptors,
} from "../gateway/methods/registry.js";
import { handleGatewayRequest, coreGatewayHandlers } from "../gateway/server-methods.js";
import type { GatewayClient, GatewayRequestContext } from "../gateway/server-methods/types.js";

export async function requestTasks(ownerKey: string, respond = vi.fn()) {
  const client: GatewayClient = {
    connId: "task-read-fixture",
    connect: {
      minProtocol: 1,
      maxProtocol: 1,
      client: {
        id: "openclaw-control-ui",
        version: "test",
        platform: "test",
        mode: "webchat",
      },
      role: "operator",
      scopes: ["operator.read"],
    },
  };
  await handleGatewayRequest({
    req: {
      type: "req",
      id: "task-read",
      method: "tasks.list",
      params: { limit: 5, sessionKey: ownerKey },
    },
    client,
    context: { getRuntimeConfig: () => ({}) } as GatewayRequestContext,
    methodRegistry: createGatewayMethodRegistry(
      createCoreGatewayMethodDescriptors(coreGatewayHandlers),
    ),
    isWebchatConnect: () => false,
    respond,
  });
  return respond;
}

export interface BridgeRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

export type ExecutionMode = "live" | "script";

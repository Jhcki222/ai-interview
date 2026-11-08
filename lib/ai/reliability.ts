export type StatusCode =
  | "initializing"
  | "connecting"
  | "processing"
  | "validating"
  | "retrying"
  | "fallback"
  | "completed"
  | "timeout"
  | "ratelimit"
  | "missingconfig"
  | "failed"
  | "cancelled";
export type AIStatus = {
  state: StatusCode;
  message: string;
  provider?: string;
  model?: string;
  attempt?: number;
  elapsedMs?: number;
  code?: string;
  retryAfterMs?: number;
  correlationId?: string;
};

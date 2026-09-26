import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createSafeDiagnostic } from "./sanitize";
import {
  SIBYL_REQUIRED_TOOLS,
  type SibylDiagnosticCode,
  type SibylJsonObject,
  type SibylMcpTransport,
  type SibylRpcNotification,
  type SibylRpcRequest,
  type SibylRpcResponse,
  type SibylStdioTransportConfig,
  type SibylToolArguments,
  type SibylToolName,
  type SibylTransportError,
  type SibylTransportPhase,
  type SibylTransportStatus,
} from "./types";

export const DEFAULT_STDIO_CONFIG: SibylStdioTransportConfig = {
  command: "sibyl-memory-mcp",
  args: [],
  protocolVersions: ["2024-11-05", "2024-10-07"],
  clientInfo: { name: "krineo", version: "0.1.0" },
  startupTimeoutMs: 10_000,
  requestTimeoutMs: 15_000,
  shutdownGraceMs: 2_000,
  maxLineBytes: 2_000_000,
  shell: false,
};

class StdioTransportError extends Error implements SibylTransportError {
  readonly diagnosticCode: SibylDiagnosticCode;
  readonly retryable: boolean;

  constructor(message: string, diagnosticCode: SibylDiagnosticCode, retryable = false) {
    super(message);
    this.name = "StdioTransportError";
    this.diagnosticCode = diagnosticCode;
    this.retryable = retryable;
  }
}

interface PendingRequest {
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

export class StdioSibylMcpTransport implements SibylMcpTransport {
  private phase: SibylTransportPhase = "NEW";
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly config: SibylStdioTransportConfig;
  private nextId = 1;
  private readonly pending = new Map<number | string, PendingRequest>();
  private buffer = "";
  private negotiatedProtocolVersion?: string;
  private lastDiagnosticCode?: SibylDiagnosticCode;

  constructor(config: Partial<SibylStdioTransportConfig> = {}) {
    if ((config as { shell?: boolean }).shell === true) {
      throw new Error("StdioSibylMcpTransport: shell execution is forbidden.");
    }
    this.config = { ...DEFAULT_STDIO_CONFIG, ...config, shell: false };
  }

  async start(): Promise<void> {
    if (this.phase === "READY") {
      return;
    }
    if (this.phase === "STARTING") {
      throw new StdioTransportError("Transport startup is already in progress.", "UNAVAILABLE");
    }
    this.phase = "STARTING";

    let startupTimer: NodeJS.Timeout | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        startupTimer = setTimeout(() => {
          this.terminateChild("SIGTERM");
          this.phase = "FAILED";
          this.lastDiagnosticCode = "TIMEOUT";
          reject(new StdioTransportError("Startup timed out before handshake completed.", "TIMEOUT"));
        }, this.config.startupTimeoutMs);

        try {
          this.child = spawn(this.config.command, [...this.config.args], {
            shell: false,
            cwd: this.config.cwd,
            env: this.config.env ? { ...process.env, ...this.config.env } : process.env,
            stdio: ["pipe", "pipe", "pipe"],
          });
        } catch {
          this.phase = "FAILED";
          this.lastDiagnosticCode = "PROCESS_START_FAILED";
          reject(new StdioTransportError("Failed to spawn MCP process.", "PROCESS_START_FAILED"));
          return;
        }

        this.child.on("error", () => {
          this.handleProcessFailure("PROCESS_START_FAILED");
          reject(new StdioTransportError("Process error during startup.", "PROCESS_START_FAILED"));
        });

        this.child.on("exit", (code) => {
          if (this.phase === "STOPPING" || this.phase === "CLOSED" || this.phase === "FAILED") {
            if (this.phase !== "FAILED") {
              this.phase = "CLOSED";
            }
            return;
          }
          if (this.phase === "STARTING") {
            this.handleProcessFailure("PROCESS_EXITED");
            reject(
              new StdioTransportError(
                `Process exited with code ${code ?? "null"} during startup.`,
                "PROCESS_EXITED",
              ),
            );
          } else {
            this.handleProcessFailure("PROCESS_EXITED");
          }
        });

        this.child.stdout.on("data", (chunk: Buffer) => {
          this.handleStdoutData(chunk);
        });

        this.child.stderr.on("data", () => {
          // Drain stderr; never leak raw stderr to logs or diagnostics
        });

        // Execute handshake sequence
        this.performHandshake()
          .then(() => {
            this.phase = "READY";
            resolve();
          })
          .catch((err) => {
            this.phase = "FAILED";
            this.lastDiagnosticCode = (err as StdioTransportError).diagnosticCode ?? "HANDSHAKE_FAILED";
            this.terminateChild("SIGTERM");
            reject(err);
          });
      });
    } finally {
      clearTimeout(startupTimer);
    }
  }

  private async performHandshake(): Promise<void> {
    // 1. Send initialize
    const initResponse = await this.sendRpcRequest("initialize", {
      protocolVersion: this.config.protocolVersions[0],
      capabilities: {},
      clientInfo: this.config.clientInfo,
    });

    if (!initResponse || typeof initResponse !== "object") {
      throw new StdioTransportError("Invalid initialize response from server.", "HANDSHAKE_FAILED");
    }
    const initRec = initResponse as Record<string, unknown>;
    if (typeof initRec["protocolVersion"] !== "string") {
      throw new StdioTransportError("Invalid initialize response from server.", "HANDSHAKE_FAILED");
    }
    const version = initRec["protocolVersion"];

    if (!this.config.protocolVersions.includes(version)) {
      throw new StdioTransportError(
        `Unsupported protocol version "${version}".`,
        "HANDSHAKE_FAILED",
      );
    }
    this.negotiatedProtocolVersion = version;

    // 2. Send initialized notification
    this.sendRpcNotification("notifications/initialized", {});

    // 3. Request tools/list and validate 8 required tools
    const toolsResponse = await this.sendRpcRequest("tools/list", {});

    if (!toolsResponse || typeof toolsResponse !== "object") {
      throw new StdioTransportError("Invalid tools/list response from server.", "HANDSHAKE_FAILED");
    }
    const toolsRec = toolsResponse as Record<string, unknown>;
    if (!Array.isArray(toolsRec["tools"])) {
      throw new StdioTransportError("Invalid tools/list response from server.", "HANDSHAKE_FAILED");
    }

    const availableToolNames = new Set<string>();
    for (const tool of toolsRec["tools"]) {
      if (tool && typeof tool === "object" && "name" in tool && typeof tool.name === "string") {
        availableToolNames.add(tool.name);
      }
    }

    for (const required of SIBYL_REQUIRED_TOOLS) {
      if (!availableToolNames.has(required)) {
        throw new StdioTransportError(
          `Required Sibyl tool "${required}" is missing from server tools list.`,
          "HANDSHAKE_FAILED",
        );
      }
    }
  }

  async callTool<Name extends SibylToolName>(
    name: Name,
    args: SibylToolArguments[Name],
  ): Promise<unknown> {
    if (this.phase !== "READY") {
      throw new StdioTransportError("Transport is not ready.", "UNAVAILABLE");
    }
    const response = await this.sendRpcRequest("tools/call", {
      name,
      arguments: args,
    });
    return this.parseToolResult(response);
  }

  private parseToolResult(response: unknown): unknown {
    if (typeof response !== "object" || response === null) {
      throw new StdioTransportError("Invalid tool response shape.", "INVALID_RESPONSE");
    }
    const rec = response as Record<string, unknown>;

    // Handle isError = true from FastMCP / ToolError
    if (rec["isError"] === true) {
      const content = rec["content"];
      let errorCode: SibylDiagnosticCode = "ERROR";
      let errorMsg = "Tool call failed.";

      if (Array.isArray(content) && content.length > 0) {
        const first = content[0];
        if (first && typeof first === "object" && "text" in first && typeof first.text === "string") {
          try {
            const parsed: unknown = JSON.parse(first.text);
            if (parsed && typeof parsed === "object") {
              const parsedRec = parsed as Record<string, unknown>;
              if (typeof parsedRec["code"] === "string") {
                const code = parsedRec["code"];
                if (code === "CAP_EXCEEDED") errorCode = "CAP_EXCEEDED";
                else if (code === "NOT_FOUND") errorCode = "NOT_FOUND";
                else if (code === "TIER_GATED") errorCode = "TIER_GATED";
                else if (code === "VALIDATION_ERROR") errorCode = "VALIDATION_ERROR";
              }
              if (typeof parsedRec["message"] === "string") {
                errorMsg = parsedRec["message"];
              }
            }
          } catch {
            // Not JSON text
          }
        }
      }
      throw new StdioTransportError(errorMsg, errorCode);
    }

    // Normal successful tool result
    if (rec["structuredContent"] !== undefined) {
      return rec["structuredContent"];
    }
    const content = rec["content"];
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0];
      if (first && typeof first === "object" && "text" in first && typeof first.text === "string") {
        try {
          return JSON.parse(first.text);
        } catch {
          return { text: first.text };
        }
      }
    }
    return rec;
  }

  private sendRpcRequest(method: string, params?: SibylJsonObject): Promise<unknown> {
    const id = this.nextId++;
    const request: SibylRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.handleProcessFailure("TIMEOUT");
        reject(new StdioTransportError(`Request ${method} timed out.`, "TIMEOUT"));
      }, this.config.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const line = JSON.stringify(request) + "\n";
      if (!this.child || !this.child.stdin.writable) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new StdioTransportError("Stdin is not writable.", "UNAVAILABLE"));
        return;
      }
      try {
        this.child.stdin.write(line, "utf8");
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new StdioTransportError("Failed to write to stdin.", "UNAVAILABLE"));
      }
    });
  }

  private sendRpcNotification(method: string, params?: SibylJsonObject): void {
    const notification: SibylRpcNotification = {
      jsonrpc: "2.0",
      method,
      ...(params !== undefined ? { params } : {}),
    };
    if (this.child && this.child.stdin.writable) {
      try {
        this.child.stdin.write(JSON.stringify(notification) + "\n", "utf8");
      } catch {
        // Notification write failed
      }
    }
  }

  private handleStdoutData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");
    if (this.buffer.length > this.config.maxLineBytes * 2) {
      this.handleProcessFailure("MESSAGE_TOO_LARGE");
      return;
    }

    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.length > 0) {
        if (line.length > this.config.maxLineBytes) {
          this.handleProcessFailure("MESSAGE_TOO_LARGE");
          return;
        }
        try {
          const parsed = JSON.parse(line) as SibylRpcResponse;
          this.handleRpcResponse(parsed);
        } catch {
          this.handleProcessFailure("PROTOCOL_ERROR");
          return;
        }
      }
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  private handleRpcResponse(response: SibylRpcResponse): void {
    if (response.id === null || response.id === undefined) {
      return;
    }
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    this.pending.delete(response.id);
    clearTimeout(pending.timer);

    if (response.error) {
      pending.reject(
        new StdioTransportError(
          response.error.message ?? "RPC Error",
          "RPC_ERROR",
        ),
      );
      return;
    }
    pending.resolve(response.result);
  }

  private handleProcessFailure(code: SibylDiagnosticCode): void {
    if (this.phase === "CLOSED" || this.phase === "STOPPING") {
      return;
    }
    this.phase = "FAILED";
    this.lastDiagnosticCode = code;
    for (const [, req] of this.pending.entries()) {
      clearTimeout(req.timer);
      req.reject(new StdioTransportError(`Transport failure (${code}).`, code));
    }
    this.pending.clear();
    this.terminateChild("SIGTERM");
  }

  private terminateChild(signal: "SIGTERM" | "SIGKILL"): void {
    const proc = this.child;
    if (!proc || proc.exitCode !== null || proc.signalCode !== null) {
      return;
    }
    try {
      proc.kill(signal);
    } catch {
      // Ignore kill errors
    }
    if (signal === "SIGTERM") {
      setTimeout(() => {
        const current = this.child;
        if (current && current.exitCode === null && current.signalCode === null) {
          try {
            current.kill("SIGKILL");
          } catch {
            // Ignore
          }
        }
      }, this.config.shutdownGraceMs);
    }
  }

  async close(): Promise<void> {
    if (this.phase === "CLOSED") {
      return;
    }
    this.phase = "STOPPING";
    for (const [, req] of this.pending.entries()) {
      clearTimeout(req.timer);
      req.reject(new StdioTransportError("Transport was closed.", "UNAVAILABLE"));
    }
    this.pending.clear();
    this.terminateChild("SIGTERM");
    this.phase = "CLOSED";
  }

  getStatus(): SibylTransportStatus {
    return {
      phase: this.phase,
      available: this.phase === "READY",
      protocolVersion: this.negotiatedProtocolVersion,
      ...(this.phase === "FAILED"
        ? {
            lastDiagnostic: createSafeDiagnostic(
              this.lastDiagnosticCode ?? "UNAVAILABLE",
              "Transport has failed.",
            ),
          }
        : {}),
    };
  }
}

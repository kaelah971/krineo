import { DefaultSibylMemoryBridge } from "./bridge";
import { StdioSibylMcpTransport, DEFAULT_STDIO_CONFIG } from "./stdio-transport";
import type { SibylMemoryBridge, SibylStdioTransportConfig } from "./types";

export { StdioSibylMcpTransport, DEFAULT_STDIO_CONFIG };

export function createStdioSibylBridge(
  config?: Partial<SibylStdioTransportConfig>,
): SibylMemoryBridge {
  const transport = new StdioSibylMcpTransport(config);
  return new DefaultSibylMemoryBridge(transport);
}

// ── MCP-PTB Entry Point ──

import { startServer } from "./server.js";

// Start the server
startServer().catch((error) => {
  console.error("[server] Failed to start:", error);
  process.exit(1);
});
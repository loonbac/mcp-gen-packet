export interface MCPClient {
  name: string;
  id: string;
  detect(): boolean;
  configPath(): string | null;
  inject(projectPath: string): Promise<{ success: boolean; backup?: string; error?: string }>;
}
export interface ClientInjectionResult {
  readonly success: boolean;
  readonly backup?: string;
  readonly error?: string;
}

export interface MCPClient {
  readonly name: string;
  readonly id: string;
  detect(): boolean;
  configPath(): string | null;
  inject(projectPath: string): Promise<ClientInjectionResult>;
}

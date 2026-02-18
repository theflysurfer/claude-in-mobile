export interface ServerConfig {
    transport: 'stdio' | 'http';
    metaMode: boolean;
    httpPort: number;
    httpHost: string;
}
export declare class MobileMcpServer {
    private config;
    private useMetaMode;
    constructor(config: ServerConfig);
    run(): Promise<void>;
    private runStdio;
    private runHttp;
    /**
     * Create a new Server instance with handlers configured.
     */
    private createServer;
    private logStartup;
}
//# sourceMappingURL=server.d.ts.map
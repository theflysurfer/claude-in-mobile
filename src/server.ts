import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { tools, handleTool, deviceManager } from './tool-handlers.js';
import { getMetaToolDefinition, getSearchToolDefinition, executeMetaAction, executeSearch } from './meta-tool.js';

export interface ServerConfig {
  transport: 'stdio' | 'http' | 'sse';
  metaMode: boolean;
  httpPort: number;
  httpHost: string;
}

export class MobileMcpServer {
  private useMetaMode: boolean;

  constructor(private config: ServerConfig) {
    this.useMetaMode = config.metaMode;
  }

  async run(): Promise<void> {
    if (this.config.transport === 'sse') {
      await this.runSse();
    } else if (this.config.transport === 'http') {
      await this.runHttp();
    } else {
      await this.runStdio();
    }
  }

  private async runStdio(): Promise<void> {
    const server = this.createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Mobile MCP Server running on stdio');
    this.logStartup();

    const shutdown = async () => {
      await server.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  private async runHttp(): Promise<void> {
    const express = (await import('express')).default;
    const host = this.config.httpHost;
    const port = this.config.httpPort;

    const app = express();
    app.use(express.json());

    // Stateless mode: each request gets a fresh server + transport
    // This is the pattern MetaMcp expects
    app.post('/mcp', async (req: import('express').Request, res: import('express').Response) => {
      const server = this.createServer();

      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);

        res.on('close', () => {
          transport.close();
          server.close();
        });
      } catch (error) {
        console.error(`HTTP request error: ${(error as Error).message}`);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    });

    // Method not allowed for GET/DELETE
    app.get('/mcp', (_req: import('express').Request, res: import('express').Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed. Use POST.' },
        id: null,
      });
    });

    app.delete('/mcp', (_req: import('express').Request, res: import('express').Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      });
    });

    // Health check endpoint
    app.get('/health', (_req: import('express').Request, res: import('express').Response) => {
      res.json({
        status: 'ok',
        server: 'mobile-mcp-server',
        version: '2.11.0',
        metaMode: this.useMetaMode,
      });
    });

    app.listen(port, host, () => {
      console.error(`Mobile MCP Server running on http://${host}:${port}/mcp`);
      this.logStartup();
      console.error(`Health check: http://${host}:${port}/health`);
    });

    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));
  }

  private async runSse(): Promise<void> {
    const express = (await import('express')).default;
    const host = this.config.httpHost;
    const port = this.config.httpPort;

    const app = express();
    app.use(express.json());

    // Stateful: one server + transport per SSE session
    const sessions = new Map<string, { server: Server; transport: SSEServerTransport }>();

    // GET /sse - Client establishes SSE stream
    app.get('/sse', async (req: import('express').Request, res: import('express').Response) => {
      const server = this.createServer();
      const transport = new SSEServerTransport('/messages', res);

      sessions.set(transport.sessionId, { server, transport });

      res.on('close', () => {
        sessions.delete(transport.sessionId);
        server.close();
      });

      await server.connect(transport);
    });

    // POST /messages?sessionId=xxx - Client sends JSON-RPC messages
    app.post('/messages', async (req: import('express').Request, res: import('express').Response) => {
      const sessionId = req.query.sessionId as string;
      const session = sessions.get(sessionId);

      if (!session) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Invalid or expired session. Reconnect via GET /sse.' },
          id: null,
        });
        return;
      }

      await session.transport.handlePostMessage(req, res, req.body);
    });

    // Health check
    app.get('/health', (_req: import('express').Request, res: import('express').Response) => {
      res.json({
        status: 'ok',
        server: 'mobile-mcp-server',
        version: '2.11.0',
        metaMode: this.useMetaMode,
        transport: 'sse',
        activeSessions: sessions.size,
      });
    });

    app.listen(port, host, () => {
      console.error(`Mobile MCP Server running on http://${host}:${port}/sse`);
      this.logStartup();
      console.error(`  SSE: GET http://${host}:${port}/sse`);
      console.error(`  Messages: POST http://${host}:${port}/messages?sessionId=<id>`);
      console.error(`  Health: http://${host}:${port}/health`);
    });

    const shutdown = async () => {
      for (const [id, session] of sessions) {
        await session.transport.close();
        await session.server.close();
        sessions.delete(id);
      }
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * Create a new Server instance with handlers configured.
   */
  private createServer(): Server {
    const server = new Server(
      { name: 'mobile', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } },
    );

    // ── List tools ──
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (this.useMetaMode) {
        return { tools: [getMetaToolDefinition(), getSearchToolDefinition()] };
      }
      return { tools };
    });

    // ── Call tool ──
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Handle mobile_search tool
        if (name === 'mobile_search') {
          const query = (args as Record<string, unknown>)?.query as string || '';
          const result = executeSearch(query);
          return { content: [{ type: 'text', text: result }] };
        }

        let result: unknown;

        if (this.useMetaMode || name === 'mobile') {
          result = await executeMetaAction(
            (args || {}) as Record<string, unknown>,
            handleTool,
          );
        } else {
          result = await handleTool(name, (args || {}) as Record<string, unknown>);
        }

        // Handle image response (optionally with text)
        if (typeof result === 'object' && result !== null && 'image' in result) {
          const img = (result as { image: { data: string; mimeType: string }; text?: string }).image;
          const text = (result as { text?: string }).text;
          const content: Array<{ type: string; data?: string; mimeType?: string; text?: string }> = [
            { type: 'image', data: img.data, mimeType: img.mimeType },
          ];
          if (text) {
            content.push({ type: 'text', text });
          }
          return { content };
        }

        // Handle text response
        const text = typeof result === 'object' && result !== null && 'text' in result
          ? (result as { text: string }).text
          : JSON.stringify(result);

        return {
          content: [{ type: 'text', text }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });

    // ── List resources ──
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'mobile://logs',
            name: 'Device logs',
            description: 'Recent device logs (can be dropped from context after reading)',
            mimeType: 'text/plain',
          },
          {
            uri: 'mobile://ui',
            name: 'UI tree',
            description: 'Current UI hierarchy in compact format (droppable context)',
            mimeType: 'text/plain',
          },
          {
            uri: 'mobile://info',
            name: 'System info',
            description: 'Device battery, memory, current activity',
            mimeType: 'text/plain',
          },
        ],
      };
    });

    // ── Read resource ──
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        let text = '';

        switch (uri) {
          case 'mobile://logs': {
            const result = await handleTool('get_logs', { lines: 50 }) as { text: string };
            text = result.text;
            break;
          }
          case 'mobile://ui': {
            const result = await handleTool('get_ui', {}) as { text: string };
            text = result.text;
            break;
          }
          case 'mobile://info': {
            const result = await handleTool('get_system_info', {}) as { text: string };
            text = result.text;
            break;
          }
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }

        return {
          contents: [{ uri, text, mimeType: 'text/plain' }],
        };
      } catch (error: any) {
        return {
          contents: [{ uri, text: `Error: ${error.message}`, mimeType: 'text/plain' }],
        };
      }
    });

    return server;
  }

  private logStartup(): void {
    console.error(`  Meta-tool mode: ${this.useMetaMode ? 'ON (single "mobile" tool)' : 'OFF (individual tools)'}`);
    console.error(`  Transport: ${this.config.transport}`);
    if (this.config.transport === 'http') {
      console.error(`  URL: http://${this.config.httpHost}:${this.config.httpPort}/mcp`);
    } else if (this.config.transport === 'sse') {
      console.error(`  URL: http://${this.config.httpHost}:${this.config.httpPort}/sse`);
    }
  }
}

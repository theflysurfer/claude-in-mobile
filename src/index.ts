#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { MobileMcpServer } from './server.js';
import type { ServerConfig } from './server.js';

const program = new Command();

program
  .name('claude-mobile')
  .description('MCP server for mobile device automation with meta-tool pattern')
  .version('2.11.0')
  .option(
    '--transport <type>',
    'Transport: stdio (default), http (StreamableHTTP), or sse',
    'stdio',
  )
  .option('--port <number>', 'HTTP port (default: 3100)', '3100')
  .option('--host <address>', 'HTTP host (default: 127.0.0.1)', '127.0.0.1')
  .option('--no-meta', 'Disable meta-tool mode (expose individual tools)')
  .action(async (options) => {
    const transport = options.transport as 'stdio' | 'http' | 'sse';
    const metaMode = options.meta !== false;
    const httpPort = parseInt(options.port as string, 10);
    const httpHost = options.host as string;

    // Display startup banner
    console.error(chalk.cyan.bold('\n  Mobile MCP Server v2.11.0'));
    console.error(chalk.gray('  ─────────────────────────────'));
    console.error(`  ${chalk.white('Transport:')} ${chalk.green(transport)}${transport === 'http' ? chalk.gray(` (${httpHost}:${httpPort})`) : ''}`);
    console.error(`  ${chalk.white('Meta-tool:')} ${metaMode ? chalk.green('ON (single "mobile" tool)') : chalk.yellow('OFF (individual tools)')}`);
    if (transport === 'http') {
      console.error(`  ${chalk.white('Endpoint:')} ${chalk.cyan(`http://${httpHost}:${httpPort}/mcp`)}`);
    } else if (transport === 'sse') {
      console.error(`  ${chalk.white('SSE:')}      ${chalk.cyan(`http://${httpHost}:${httpPort}/sse`)}`);
    }
    console.error(chalk.gray('  ─────────────────────────────\n'));

    const config: ServerConfig = {
      transport,
      metaMode,
      httpPort,
      httpHost,
    };

    const server = new MobileMcpServer(config);
    await server.run();
  });

program.parse();

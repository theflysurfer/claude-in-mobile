/**
 * Meta-tool pattern for Mobile MCP Server.
 * Exposes a single "mobile" tool instead of 40+ individual tools,
 * reducing token usage from ~15-20k to ~2-3k.
 */
import type { handleTool as HandleToolFn } from './tool-handlers.js';
/**
 * Returns the MCP tool definition for the single "mobile" meta-tool.
 * Telegraphic description to minimize token usage (~800 tokens vs ~1500).
 */
export declare function getMetaToolDefinition(): {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            action: {
                type: string;
                description: string;
            };
            platform: {
                type: string;
                enum: string[];
            };
        };
        required: string[];
        additionalProperties: boolean;
    };
};
/**
 * Route a meta-tool call to the appropriate internal tool handler.
 */
export declare function executeMetaAction(args: Record<string, unknown>, handleToolFn: typeof HandleToolFn): Promise<unknown>;
/**
 * Get the list of available actions.
 */
export declare function getAvailableActions(): string[];
//# sourceMappingURL=meta-tool.d.ts.map
/**
 * Meta-tool pattern for Mobile MCP Server.
 * - Single "mobile" tool with action dispatch
 * - "mobile_search" for action discovery (Dynamic Toolset pattern)
 * - Platform-aware descriptions (filters irrelevant sections)
 */
import type { handleTool as HandleToolFn } from './tool-handlers.js';
/**
 * Main mobile tool - dynamically filtered by active platform.
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
 * Search/describe tool - Dynamic Toolset pattern.
 * LLM queries this to get detailed params for specific actions.
 */
export declare function getSearchToolDefinition(): {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            query: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
/**
 * Execute search: find matching actions or describe specific ones.
 */
export declare function executeSearch(query: string): string;
/**
 * Route a meta-tool call to the appropriate internal tool handler.
 */
export declare function executeMetaAction(args: Record<string, unknown>, handleToolFn: typeof HandleToolFn): Promise<unknown>;
/**
 * Get the list of available actions.
 */
export declare function getAvailableActions(): string[];
//# sourceMappingURL=meta-tool.d.ts.map
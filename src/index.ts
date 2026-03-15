/**
 * CodeAgora V3 - Main Entry Point
 */

export { runPipeline } from './pipeline/orchestrator.js';
export { SessionManager } from './session/manager.js';
export { loadConfig } from './config/loader.js';

export type { PipelineInput, PipelineResult } from './pipeline/orchestrator.js';
export type { Config } from './types/config.js';
export type { SessionMetadata, HeadVerdict, ModeratorReport } from './types/core.js';

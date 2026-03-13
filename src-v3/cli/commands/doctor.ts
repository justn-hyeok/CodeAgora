/**
 * Doctor Command
 * Check environment and configuration health.
 */

import fs from 'fs/promises';
import path from 'path';
import { getSupportedProviders } from '../../l1/provider-registry.js';
import { loadConfigFrom } from '../../config/loader.js';
import { strictValidateConfig } from '../../config/validator.js';
import { getProviderEnvVar } from '../../providers/env-vars.js';

// ============================================================================
// Types
// ============================================================================

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  summary: { pass: number; fail: number; warn: number };
}

// ============================================================================
// Helpers
// ============================================================================

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function checkNodeVersion(): DoctorCheck {
  const version = process.version; // e.g. "v22.0.0"
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major >= 18) {
    return { name: 'Node.js version', status: 'pass', message: `Node.js ${version}` };
  }
  return {
    name: 'Node.js version',
    status: 'fail',
    message: `Node.js ${version} — v18+ required`,
  };
}

// ============================================================================
// Public API
// ============================================================================

export async function runDoctor(baseDir: string): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];

  // 1. Node.js version
  checks.push(checkNodeVersion());

  // 2. .ca/ directory existence
  const caDir = path.join(baseDir, '.ca');
  const caExists = await dirExists(caDir);
  checks.push({
    name: '.ca/ directory',
    status: caExists ? 'pass' : 'warn',
    message: caExists ? `.ca/ directory found` : `.ca/ directory missing — run 'init' first`,
  });

  // 3. Config file existence
  const jsonPath = path.join(caDir, 'config.json');
  const yamlPath = path.join(caDir, 'config.yaml');
  const ymlPath = path.join(caDir, 'config.yml');

  const [jsonExists, yamlExists, ymlExists] = await Promise.all([
    fileExists(jsonPath),
    fileExists(yamlPath),
    fileExists(ymlPath),
  ]);

  const configExists = jsonExists || yamlExists || ymlExists;
  const configFile = jsonExists
    ? '.ca/config.json'
    : yamlExists
    ? '.ca/config.yaml'
    : ymlExists
    ? '.ca/config.yml'
    : null;

  checks.push({
    name: 'Config file',
    status: configExists ? 'pass' : 'fail',
    message: configExists
      ? `Config: ${configFile}`
      : `Config file not found in .ca/ — run 'init' to create one`,
  });

  // 4. Config validity (only if config exists)
  if (configExists) {
    try {
      const config = await loadConfigFrom(baseDir);
      const validation = strictValidateConfig(config);
      if (validation.valid && validation.warnings.length === 0) {
        checks.push({ name: 'Config validity', status: 'pass', message: 'Config is valid' });
      } else if (!validation.valid) {
        checks.push({
          name: 'Config validity',
          status: 'fail',
          message: `Config errors: ${validation.errors.join('; ')}`,
        });
      } else {
        checks.push({
          name: 'Config validity',
          status: 'warn',
          message: `Config warnings: ${validation.warnings.join('; ')}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({ name: 'Config validity', status: 'fail', message: `Config load failed: ${msg}` });
    }
  }

  // 5. Provider API keys
  const providers = getSupportedProviders();
  for (const provider of providers) {
    // Derive the env var name from PROVIDER_FACTORIES indirectly via provider name convention
    // We'll read the env var by looking up what the registry exposes
    const envVarName = getProviderEnvVar(provider);
    const isSet = Boolean(process.env[envVarName]);
    checks.push({
      name: `${envVarName}`,
      status: isSet ? 'pass' : 'warn',
      message: isSet ? `${envVarName}: set` : `${envVarName}: missing`,
    });
  }

  const summary = {
    pass: checks.filter((c) => c.status === 'pass').length,
    fail: checks.filter((c) => c.status === 'fail').length,
    warn: checks.filter((c) => c.status === 'warn').length,
  };

  return { checks, summary };
}

// getProviderEnvVar is re-exported for backward compatibility
export { getProviderEnvVar } from '../../providers/env-vars.js';

export function formatDoctorReport(result: DoctorResult): string {
  const lines: string[] = [];
  for (const check of result.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!';
    lines.push(`${icon} ${check.message}`);
  }
  lines.push('');
  lines.push(
    `Summary: ${result.summary.pass} passed, ${result.summary.fail} failed, ${result.summary.warn} warnings`
  );
  return lines.join('\n');
}

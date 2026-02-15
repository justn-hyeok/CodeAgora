/**
 * anonymize command
 * Anonymize opponent opinions by severity grouping
 * Removes reviewer names to reduce conformity bias
 */

import type { AnonymizeOutput } from '../types/index.js';
import { AnonymizeInputSchema } from '../types/index.js';

export function anonymize(inputJson: string): string {
  try {
    const input = JSON.parse(inputJson) as unknown;
    const validated = AnonymizeInputSchema.parse(input);

    // Group by severity
    const bySeverity = new Map<string, string[]>();

    for (const opinion of validated.opinions) {
      const severity = opinion.severity.toLowerCase();
      if (!bySeverity.has(severity)) {
        bySeverity.set(severity, []);
      }
      bySeverity.get(severity)!.push(opinion.reasoning);
    }

    // Build anonymized output
    const lines: string[] = [];

    for (const [severity, reasonings] of bySeverity) {
      const count = reasonings.length;
      const plural = count === 1 ? 'reviewer' : 'reviewers';

      lines.push(`**${count} ${plural} identified as ${severity.toUpperCase()}:**`);
      lines.push('');

      for (let i = 0; i < reasonings.length; i++) {
        lines.push(`${i + 1}. ${reasonings[i]}`);
        lines.push('');
      }
    }

    const output: AnonymizeOutput = {
      anonymized: lines.join('\n'),
    };

    return JSON.stringify(output, null, 2);
  } catch (error) {
    return JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    );
  }
}

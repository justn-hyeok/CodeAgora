import type {
  SupporterBackend,
  SupporterValidationRequest,
  SupporterValidationResult,
} from './types.js';
import type { ReviewIssue } from '../parser/schema.js';
import { createLLMAdapter } from '../llm/adapter.js';
import { getProviderConfig } from '../llm/config.js';

/**
 * Gemini supporter uses LLM reasoning for validation
 * Unlike Codex which uses static analysis tools, Gemini uses AI inference
 */
export class GeminiSupporter implements SupporterBackend {
  name = 'gemini';
  private provider = 'google';
  private model = 'gemini-2.0-flash-exp';

  async validate(request: SupporterValidationRequest): Promise<SupporterValidationResult> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(request);

      // Get provider configuration
      const providerConfig = getProviderConfig('google');

      // Create LLM adapter
      const adapter = createLLMAdapter('google', providerConfig);

      // Call LLM API directly
      const result = await adapter.call({
        provider: 'google',
        model: this.model,
        systemPrompt,
        prompt: userPrompt,
        timeout: 30000, // 30s timeout
      });

      if (!result.success) {
        return {
          issue: request.issue,
          validated: false,
          evidence: `Gemini API error: ${result.error}`,
          confidence: 0.5,
        };
      }

      // Parse response
      const validation = this.parseValidationResponse(result.response, request.issue);

      return validation;
    } catch (error) {
      return {
        issue: request.issue,
        validated: false,
        evidence: `Gemini validation error: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0.5,
      };
    }
  }

  private buildSystemPrompt(): string {
    return `You are a code validation assistant. Your task is to verify whether a reported code issue is legitimate.

Given:
- A reported issue (severity, category, description)
- The code context

Your job:
1. Analyze the code carefully
2. Determine if the reported issue is valid
3. Provide evidence for your conclusion
4. Rate your confidence (0.0-1.0)

Output format:
VALIDATED: yes/no
EVIDENCE: [your explanation]
CONFIDENCE: [0.0-1.0]

Be objective and evidence-based. Don't just agree with the original report - independently verify it.`;
  }

  private buildUserPrompt(request: SupporterValidationRequest): string {
    return `# Validation Request

## Reported Issue
- File: ${request.file}
- Line: ${request.issue.line}
- Severity: ${request.issue.severity}
- Category: ${request.issue.category}
- Title: ${request.issue.title}
- Description: ${request.issue.description}

## Code Context
\`\`\`
${request.context}
\`\`\`

## Task
Verify if this issue is legitimate. Provide:
1. VALIDATED: yes or no
2. EVIDENCE: explain your reasoning
3. CONFIDENCE: 0.0-1.0

Be thorough and objective.`;
  }

  private parseValidationResponse(
    response: string,
    issue: ReviewIssue
  ): SupporterValidationResult {
    const validatedMatch = response.match(/VALIDATED:\s*(yes|no)/i);
    const evidenceMatch = response.match(/EVIDENCE:\s*(.+?)(?=\nCONFIDENCE:|$)/is);
    const confidenceMatch = response.match(/CONFIDENCE:\s*([0-9.]+)/i);

    const validated = validatedMatch?.[1].toLowerCase() === 'yes';
    const evidence =
      evidenceMatch?.[1].trim() || 'No evidence provided';
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;

    return {
      issue,
      validated,
      evidence,
      toolOutput: response.slice(0, 500),
      confidence: Math.min(Math.max(confidence, 0), 1), // Clamp to [0, 1]
    };
  }
}

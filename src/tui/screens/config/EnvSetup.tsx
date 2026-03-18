import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { PROVIDER_ENV_VARS } from '../../../providers/env-vars.js';
import { saveCredential, getCredentialsPath } from '../../../config/credentials.js';
import { Panel } from '../../components/Panel.js';
import { ScrollableList } from '../../components/ScrollableList.js';
import { TextInput } from '../../components/TextInput.js';
import { Toast } from '../../components/Toast.js';
import { colors, icons, getTerminalSize } from '../../theme.js';
import { t } from '../../../i18n/index.js';

// ============================================================================
// Types
// ============================================================================

type Step = 'provider' | 'key-input' | 'testing' | 'result';

interface Props {
  onDone: () => void;
}

// ============================================================================
// Component
// ============================================================================

const PROVIDERS = Object.keys(PROVIDER_ENV_VARS);

export function EnvSetup({ onDone }: Props): React.JSX.Element {
  const [step, setStep] = useState<Step>('provider');
  const [providerIndex, setProviderIndex] = useState(0);
  const [keyInput, setKeyInput] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedProvider = PROVIDERS[providerIndex] ?? 'groq';
  const envVarName = PROVIDER_ENV_VARS[selectedProvider] ?? `${selectedProvider.toUpperCase()}_API_KEY`;

  useInput((input, key) => {
    if (step === 'provider') {
      if (key.escape) { onDone(); return; }
      if (key.upArrow || input === 'k') {
        setProviderIndex(i => Math.max(0, i - 1));
      } else if (key.downArrow || input === 'j') {
        setProviderIndex(i => Math.min(PROVIDERS.length - 1, i + 1));
      } else if (key.return) {
        setStep('key-input');
      }
      return;
    }

    if (step === 'key-input') {
      if (key.escape) { setStep('provider'); setKeyInput(''); return; }
      if (key.return) {
        if (!keyInput.trim()) return;
        saveCredential(envVarName, keyInput.trim());
        process.env[envVarName] = keyInput.trim();
        setStep('testing');
        runPingTest(selectedProvider, keyInput.trim());
        return;
      }
      if (key.backspace || key.delete) { setKeyInput(s => s.slice(0, -1)); return; }
      if (input && !key.return) {
        const clean = input.replace(/[\x00-\x1F\x7F]/g, '');
        if (clean) setKeyInput(s => s + clean);
      }
      return;
    }

    if (step === 'result') {
      if (key.return || key.escape || input === 'q') { onDone(); }
    }
  });

  async function runPingTest(provider: string, _apiKey: string): Promise<void> {
    const start = Date.now();
    try {
      const { getModel } = await import('../../../l1/provider-registry.js');
      const { generateText } = await import('ai');

      const testModels: Record<string, string> = {
        groq: 'llama-3.3-70b-versatile',
        'nvidia-nim': 'deepseek-r1',
        openrouter: 'google/gemini-2.5-flash',
        google: 'gemini-2.0-flash',
        mistral: 'mistral-large-latest',
        cerebras: 'llama-3.3-70b',
        together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        xai: 'grok-2',
        openai: 'gpt-4o-mini',
        anthropic: 'claude-sonnet-4-20250514',
        deepseek: 'deepseek-chat',
        qwen: 'qwen-turbo',
        zai: 'zai-default',
        'github-models': 'gpt-4o-mini',
        'github-copilot': 'gpt-4o',
      };
      const model = testModels[provider] ?? 'llama-3.3-70b-versatile';
      const languageModel = getModel(provider, model);
      const abortSignal = AbortSignal.timeout(10_000);
      await generateText({ model: languageModel, prompt: 'Say OK', abortSignal });
      const latency = Date.now() - start;
      setTestResult({ ok: true, message: `${provider} connected (${latency}ms)` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ ok: false, message: `Connection failed: ${msg.slice(0, 80)}` });
    }
    setStep('result');
  }

  const { cols } = getTerminalSize();
  const totalWidth = Math.max(cols - 4, 40);

  if (step === 'provider') {
    return (
      <Panel title={`${t('config.tabs.apiKeys')} — Select Provider`} width={totalWidth}>
        <ScrollableList
          items={PROVIDERS}
          selectedIndex={providerIndex}
          height={Math.max(getTerminalSize().rows - 8, 8)}
          renderItem={(p, _i, isSelected) => {
            const envVar = PROVIDER_ENV_VARS[p] ?? '';
            const hasKey = Boolean(process.env[envVar]);
            return (
              <Text color={isSelected ? colors.selection.bg : undefined} bold={isSelected}>
                {p}
                <Text dimColor> ({envVar})</Text>
                {hasKey ? <Text color={colors.success}> {icons.check}</Text> : null}
              </Text>
            );
          }}
        />
        <Box marginTop={1}>
          <Text dimColor>Enter: select  Esc: back</Text>
        </Box>
      </Panel>
    );
  }

  if (step === 'key-input') {
    return (
      <Panel title={`${t('config.tabs.apiKeys')} — ${selectedProvider}`} width={totalWidth}>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{envVarName}:</Text>
          <TextInput value={keyInput} mask={true} isActive={true} />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Enter: save & test  Esc: back</Text>
        </Box>
      </Panel>
    );
  }

  if (step === 'testing') {
    return (
      <Panel title={`${t('config.tabs.apiKeys')} — ${selectedProvider}`} width={totalWidth}>
        <Text color={colors.warning}>Testing connection...</Text>
      </Panel>
    );
  }

  // result
  return (
    <Panel title={`${t('config.tabs.apiKeys')} — ${selectedProvider}`} width={totalWidth}>
      <Toast
        message={testResult?.message ?? ''}
        type={testResult?.ok ? 'success' : 'error'}
        visible={true}
      />
      <Box marginTop={1}>
        <Text dimColor>{getCredentialsPath()}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter/Esc: continue</Text>
      </Box>
    </Panel>
  );
}

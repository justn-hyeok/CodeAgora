import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'fs';
import path from 'path';
import { loadConfigFrom } from '../../config/loader.js';
import { validateConfig } from '../../types/config.js';
import type { Config } from '../../types/config.js';
import { ReviewersTab } from './config/ReviewersTab.js';
import { SupportersTab } from './config/SupportersTab.js';
import { ModeratorTab } from './config/ModeratorTab.js';
import { PresetsTab } from './config/PresetsTab.js';

type TabName = 'reviewers' | 'supporters' | 'moderator' | 'presets';
const TABS: TabName[] = ['reviewers', 'supporters', 'moderator', 'presets'];
const TAB_LABELS: Record<TabName, string> = {
  reviewers: 'Reviewers',
  supporters: 'Supporters',
  moderator: 'Moderator',
  presets: 'Presets',
};

interface ConfigState {
  config: Config | null;
  error: string | null;
  loading: boolean;
}

export function ConfigScreen(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('reviewers');
  const [state, setState] = useState<ConfigState>({ config: null, error: null, loading: true });
  const [saveError, setSaveError] = useState<string>('');

  useEffect(() => {
    loadConfigFrom(process.cwd()).then(cfg => {
      setState({ config: cfg, error: null, loading: false });
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ config: null, error: msg, loading: false });
    });
  }, []);

  function handleConfigChange(newConfig: Config): void {
    // Validate before saving
    try {
      validateConfig(newConfig);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      setTimeout(() => setSaveError(''), 3000);
      return;
    }

    setState(s => ({ ...s, config: newConfig }));

    const configPath = path.join(process.cwd(), '.ca', 'config.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
      setSaveError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(`Write failed: ${msg}`);
      setTimeout(() => setSaveError(''), 3000);
    }
  }

  const tabIndex = TABS.indexOf(activeTab);

  useInput((_input, key) => {
    if (key.tab) {
      const next = (tabIndex + 1) % TABS.length;
      setActiveTab(TABS[next]!);
    }
    // Shift+Tab handled via key.shift + key.tab
    if (key.shift && key.tab) {
      const prev = (tabIndex - 1 + TABS.length) % TABS.length;
      setActiveTab(TABS[prev]!);
    }
  });

  if (state.loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Configuration</Text>
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  if (state.error || !state.config) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Configuration</Text>
        <Text color="yellow">No config found. Run <Text bold>agora init</Text> first.</Text>
        {state.error ? <Text dimColor>{state.error}</Text> : null}
      </Box>
    );
  }

  const { config } = state;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Tab bar */}
      <Box flexDirection="row" marginBottom={1}>
        {TABS.map((tab, i) => {
          const active = tab === activeTab;
          return (
            <Box key={tab} marginRight={2}>
              <Text
                bold={active}
                color={active ? 'cyan' : undefined}
                underline={active}
              >
                {i + 1}. {TAB_LABELS[tab]}
              </Text>
            </Box>
          );
        })}
        <Text dimColor>  Tab to switch</Text>
      </Box>

      {/* Tab content */}
      {activeTab === 'reviewers' && (
        <ReviewersTab
          config={config}
          isActive={activeTab === 'reviewers'}
          onConfigChange={handleConfigChange}
        />
      )}
      {activeTab === 'supporters' && (
        <SupportersTab
          config={config}
          isActive={activeTab === 'supporters'}
          onConfigChange={handleConfigChange}
        />
      )}
      {activeTab === 'moderator' && (
        <ModeratorTab
          config={config}
          isActive={activeTab === 'moderator'}
          onConfigChange={handleConfigChange}
        />
      )}
      {activeTab === 'presets' && (
        <PresetsTab
          config={config}
          isActive={activeTab === 'presets'}
          onConfigChange={handleConfigChange}
        />
      )}

      {saveError ? (
        <Text color="red">{saveError}</Text>
      ) : null}
    </Box>
  );
}

/**
 * HelpOverlay — Fullscreen keybinding reference overlay.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors, borders } from '../theme.js';

export interface KeyBinding {
  key: string;
  description: string;
}

interface HelpOverlayProps {
  bindings: KeyBinding[];
  visible: boolean;
  title?: string;
}

export function HelpOverlay({
  bindings,
  visible,
  title = 'Keyboard Shortcuts',
}: HelpOverlayProps): React.JSX.Element | null {
  if (!visible) return null;

  // Find max key length for alignment
  const maxKeyLen = Math.max(...bindings.map(b => b.key.length), 6);

  return (
    <Box
      flexDirection="column"
      borderStyle={borders.panel}
      borderColor={colors.primary}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>{title}</Text>
      </Box>
      {bindings.map((binding) => (
        <Box key={binding.key} gap={1}>
          <Text color={colors.warning} bold>
            {binding.key.padEnd(maxKeyLen)}
          </Text>
          <Text dimColor>{binding.description}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>Press ? to close</Text>
      </Box>
    </Box>
  );
}

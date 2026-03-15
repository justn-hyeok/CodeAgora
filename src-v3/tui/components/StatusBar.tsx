import React from 'react';
import { Box, Text } from 'ink';
import type { Screen } from '../hooks/useRouter.js';

interface StatusBarProps {
  screen: Screen;
  canGoBack: boolean;
}

export function StatusBar({ screen, canGoBack }: StatusBarProps): React.JSX.Element {
  const backOrQuit = canGoBack ? 'q: back' : 'q: quit';
  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Text dimColor>{screen}</Text>
      <Text dimColor>{backOrQuit}  ↑↓: navigate  enter: select</Text>
    </Box>
  );
}

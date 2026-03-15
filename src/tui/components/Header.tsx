import React from 'react';
import { Box, Text } from 'ink';

export function Header(): React.JSX.Element {
  return (
    <Box borderStyle="single" paddingX={1}>
      <Text color="cyan" bold>CodeAgora</Text>
      <Text> — Multi-LLM Code Review</Text>
    </Box>
  );
}

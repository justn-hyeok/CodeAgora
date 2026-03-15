import React from 'react';
import { Box, useApp, useInput } from 'ink';
import { useRouter } from './hooks/useRouter.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { ReviewScreen } from './screens/ReviewScreen.js';
import { SessionsScreen } from './screens/SessionsScreen.js';
import { ConfigScreen } from './screens/ConfigScreen.js';
import type { Screen } from './hooks/useRouter.js';

export function App(): React.JSX.Element {
  const { exit } = useApp();
  const { screen, navigate, goBack, canGoBack } = useRouter();

  useInput((input) => {
    if (input === 'q') {
      if (canGoBack) {
        goBack();
      } else {
        exit();
      }
    }
  });

  function renderScreen(s: Screen): React.JSX.Element {
    switch (s) {
      case 'review':
        return <ReviewScreen />;
      case 'sessions':
        return <SessionsScreen />;
      case 'config':
        return <ConfigScreen />;
      case 'home':
      default:
        return <HomeScreen onNavigate={navigate} onQuit={exit} />;
    }
  }

  return (
    <Box flexDirection="column">
      <Header />
      {renderScreen(screen)}
      <StatusBar screen={screen} canGoBack={canGoBack} />
    </Box>
  );
}

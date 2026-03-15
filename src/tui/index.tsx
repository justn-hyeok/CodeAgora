import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

export function startTui(): void {
  render(React.createElement(App));
}

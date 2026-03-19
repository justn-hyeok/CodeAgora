/**
 * Dashboard Command
 * Launch the CodeAgora web dashboard.
 */

import { t } from '@codeagora/shared/i18n/index.js';

export async function startDashboard(options: { port?: number; open?: boolean }): Promise<void> {
  const port = options.port ?? 6274;
  const url = `http://127.0.0.1:${port}`;

  console.log(t('cli.dashboard.starting', { url }));

  const { startServer } = await import('@codeagora/web');
  const server = startServer({ port });

  if (options.open) {
    try {
      // Dynamic import for platform-specific browser open
      const { platform } = await import('os');
      const { execFile } = await import('child_process');
      const os = platform();
      const cmd = os === 'darwin' ? 'open' : os === 'win32' ? 'start' : 'xdg-open';
      execFile(cmd, [url], (err) => {
        if (err) {
          console.error(`Could not open browser: ${err.message}`);
        }
      });
    } catch {
      // Silently ignore if we can't open the browser
    }
  }

  // Keep the process running until interrupted
  const shutdown = () => {
    console.log(`\n${t('cli.dashboard.stopped')}`);
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

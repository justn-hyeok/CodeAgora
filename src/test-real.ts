#!/usr/bin/env node
/**
 * Real backend test runner
 */

import { runPipeline } from './dist/index.js';

async function main() {
  console.log('🚀 Starting V3 Real Test...\n');

  const result = await runPipeline({
    diffPath: '/tmp/test-warning-only.txt',
  });

  console.log('\n📊 Result:');
  console.log(`Status: ${result.status}`);
  console.log(`Session: ${result.sessionId}`);
  console.log(`Date: ${result.date}`);

  if (result.error) {
    console.log(`Error: ${result.error}`);
  } else {
    console.log(`\n✅ Success! Check results at:`);
    console.log(`.ca/sessions/${result.date}/${result.sessionId}/`);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * CodeAgora Tools CLI
 * Deterministic helper tools for multi-agent code review
 */

import { Command } from 'commander';
import { parseReviews } from './commands/parse-reviews.js';
import { voting } from './commands/voting.js';
import { anonymize } from './commands/anonymize.js';
import { score } from './commands/score.js';
import { earlyStop } from './commands/early-stop.js';
import { formatOutput } from './commands/format-output.js';

const program = new Command();

program
  .name('agora')
  .description('CodeAgora helper tools for deterministic review processing')
  .version('1.0.0');

program
  .command('parse-reviews')
  .description('Parse raw reviewer responses into structured ParsedReview objects')
  .argument('<json>', 'Input JSON string')
  .action((json: string) => {
    const output = parseReviews(json);
    console.log(output);
  });

program
  .command('voting')
  .description('Apply 75% majority voting gate to separate consensus from debate issues')
  .argument('<json>', 'Input JSON string')
  .action((json: string) => {
    const output = voting(json);
    console.log(output);
  });

program
  .command('anonymize')
  .description('Anonymize opponent opinions by severity grouping')
  .argument('<json>', 'Input JSON string')
  .action((json: string) => {
    const output = anonymize(json);
    console.log(output);
  });

program
  .command('score')
  .description('Score reasoning quality using 5 trajectory patterns')
  .argument('<json>', 'Input JSON string')
  .action((json: string) => {
    const output = score(json);
    console.log(output);
  });

program
  .command('early-stop')
  .description('Check if debate should stop early based on reasoning similarity')
  .argument('<json>', 'Input JSON string')
  .action((json: string) => {
    const output = earlyStop(json);
    console.log(output);
  });

program
  .command('format-output')
  .description('Generate markdown report from review results')
  .argument('<json>', 'Input JSON string')
  .action((json: string) => {
    const output = formatOutput(json);
    console.log(output);
  });

program.parse();

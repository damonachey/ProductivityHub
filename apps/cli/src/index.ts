#!/usr/bin/env node

import { listMyRepos } from "@productivityhub/github";

function printUsage(): void {
  console.log("ph — ProductivityHub CLI");
  console.log("Usage: ph gh repos");
}

async function main(): Promise<void> {
  const [command, subcommand] = process.argv.slice(2);

  if (command === "gh" && subcommand === "repos") {
    const repos = await listMyRepos();
    for (const repo of repos) {
      const visibility = repo.private ? "private" : "public";
      console.log(`${repo.name} (${visibility}) — updated ${repo.updatedAt}`);
    }
    return;
  }

  printUsage();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

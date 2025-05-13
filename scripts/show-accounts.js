#!/usr/bin/env node
// Prints Hardhat named accounts (address + ETH balance)
// Adds a markdown table to $GITHUB_STEP_SUMMARY when run in CI
// Usage:  node scripts/show-accounts.js  --network <network-name>


const argv = require("minimist")(process.argv.slice(2), {
    string: ["network"],
  });
  if (argv.network) {
    process.env.HARDHAT_NETWORK = argv.network;
  }
  
  const hre = require("hardhat");
  const { ethers, getNamedAccounts, network } = hre;
  const { formatEther } = ethers.utils;
  
  async function main() {
    const named = await getNamedAccounts();
    const rows = [];
    console.log(`\nNetwork: ${network.name} (chainId ${network.config.chainId})`);
    console.log("─────────");
    console.table(
      await Promise.all(
        Object.entries(named).map(async ([name, addr]) => {
          const bal = await ethers.provider.getBalance(addr);
          const eth = Number(formatEther(bal)).toFixed(4);
          rows.push(`| ${name} | ${addr} | ${eth} |`);
          return { name, address: addr, eth };
        }),
      ),
    );
  
    if (process.env.GITHUB_STEP_SUMMARY) {
      const hdr = "| name | address | balance (ETH) |";
      await require("fs").promises.appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        `### Named Accounts — ${network.name}\n${hdr}\n|---|---|---|\n${rows.join(
          "\n",
        )}\n`,
      );
    }
  }
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
  
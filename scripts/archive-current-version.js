// SPDX-License-Identifier: MIT
//
// Hardhat-Deploy-compatible snapshot of the latest deployments.
// ─────────────────────────────────────────────────────────────────────
// • Writes one JSON per contract with the fields `address`, `implementation`,
//   `abi`, and `numDeployments`.
// • Saves everything under deployments/archive/<timestamp>/<network>/
// • Safe to restore directly into deployments/<network>/ for future upgrades.
// Usage: npm run archive -- <network>
//
const fs = require("fs-extra");
const path = require("path");
const {
  deployments,
  artifacts,
  upgrades,
  network,
  ethers,
} = require("hardhat");

async function packContract(name) {
  const live = await deployments.getOrNull(name);
  if (!live) {
    console.warn(`⚠ ${name} not deployed on ${network.name}; skipping`);
    return null;
  }

  // read previous deployment file (if any) to preserve & increment numDeployments
  const depFile = path.join(__dirname, "..", "deployments", network.name, `${name}.json`);
  let prevNum = 0;
  if (await fs.pathExists(depFile)) {
    try {
      const prev = await fs.readJSON(depFile);
      prevNum = typeof prev.numDeployments === "number" ? prev.numDeployments : 0;
    } catch {/* ignore */ }
  }

  // implementation address (skip if we can’t reach a node)
  let implAddr = "N/A";
  try {
    await ethers.provider.getBlockNumber();
    implAddr = await upgrades.erc1967.getImplementationAddress(live.address);
  } catch {/* offline */ }

  const { abi } = await artifacts.readArtifact(name);

  return {
    address: live.address,
    implementation: implAddr,
    abi,
    numDeployments: prevNum,
  };
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");      // ms precision
  const archiveDir = path.join(
    __dirname,
    "..",
    "deployments",
    "archive",
    timestamp,
    network.name,
  );
  await fs.ensureDir(archiveDir);

  // list contracts you want to snapshot
  const contracts = ["MasterMinter", "TokenV1"];

  for (const name of contracts) {
    const data = await packContract(name);
    if (data) {
      await fs.writeJSON(
        path.join(archiveDir, `${name}.json`),
        data,
        { spaces: 2 },
      );
      console.log(`✓ ${name} archived (deploy #${data.numDeployments})`);
    }
  }

  // simple metadata helper
  await fs.writeJSON(
    path.join(archiveDir, "metadata.json"),
    { timestamp, network: network.name },
    { spaces: 2 },
  );

  await fs.writeFile(path.join(archiveDir, ".chainId"), network.config.chainId.toString());
  
  console.log(`🎉 Snapshot saved to ${archiveDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

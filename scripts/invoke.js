#!/usr/bin/env node
/* ------------------------------------------------------------------
   Generic Fireblocks-aware contract invoker

   tx example:
     node scripts/invoke.js \
          --network sepolia \
          --target TokenV1 \
          --fn    setPermissionAdmin \
          --args  0xSecurityVault \
          --from  deployer

   getter example:
     node scripts/invoke.js \
          --network mainnet \
          --target MasterMinter \
          --fn    getControllerAdmin
------------------------------------------------------------------- */
const path   = require("path");
const { waitTx } = require(path.join(__dirname, "..", "helpers", "deploy-utils"));
const argv   = require("minimist")(process.argv.slice(2), {
  string: ["network", "target", "fn", "args", "from"],
  default: { from: "deployer" },
});

const ALLOWED_TARGETS = ["MasterMinter", "TokenV1"];
const RED  = "\x1b[31m", GRN = "\x1b[32m", YLW = "\x1b[33m", RST = "\x1b[0m";

function usage(msg) {
  console.error(`${RED}Error:${RST} ${msg}`);
  console.error(`\nUsage:
  invoke.js --network <net> --target MasterMinter|TokenV1
            --fn <functionName> [--args a,b,c] [--from namedAcct]\n`);
  process.exit(1);
}

// ── CLI validation ─────────────────────────────────────────────────
if (!argv.network || !argv.target || !argv.fn) {
  usage("Missing required flags.");
}
if (!ALLOWED_TARGETS.includes(argv.target)) {
  usage(`target must be one of: ${ALLOWED_TARGETS.join(", ")}`);
}

// ensure Hardhat picks the right network before config loads
process.env.HARDHAT_NETWORK = argv.network;

const hre = require("hardhat");
const { deployments, ethers } = hre;

(async () => {
  try {
    /* 1 ── load deployment JSON */
    const dep = await deployments.getOrNull(argv.target);
    if (!dep) {
      throw new Error(`No deployment info for ${argv.target} on ${argv.network}`);
    }

    /* 2 ── resolve signer (Fireblocks vault or local key) */
    const named  = await hre.getNamedAccounts();
    const from   = argv.from;
    const fromAddr = named[from];
    if (!fromAddr) throw new Error(`namedAccounts has no key "${from}"`);
    const signer = await ethers.getSigner(fromAddr);

    /* 3 ── build contract */
    const contract = new ethers.Contract(dep.address, dep.abi, signer);
    const argsArr  = argv.args ? argv.args.split(",").map(a => a.trim()) : [];

    // sanity check: function exists & arg length matches ABI
    let fragment;
    try { fragment = contract.interface.getFunction(argv.fn); }
    catch { usage(`Function "${argv.fn}" not found in ABI`); }
    if (fragment.inputs.length !== argsArr.length) {
      usage(`Expected ${fragment.inputs.length} argument(s) but got ${argsArr.length}`);
    }

    console.log(`${YLW}Network:${RST} ${argv.network}`);
    console.log(`${YLW}Contract:${RST} ${argv.target} @ ${dep.address}`);
    console.log(`${YLW}Caller:${RST}  ${from}  (${fromAddr})`);
    console.log(`${YLW}Function:${RST} ${argv.fn}(${argsArr.join(", ")})`);

    /* 4 ── readonly vs state-changing */
    const isRead =
      fragment.stateMutability === "view" ||
      fragment.stateMutability === "pure" ||
      fragment.constant;

    if (isRead) {
      const result = await contract[argv.fn](...argsArr);
      console.log(`${GRN}Return:${RST}`, result);
    } else {
      const tx = await contract[argv.fn](...argsArr);
      console.log(`${YLW}tx hash:${RST} ${tx.hash}`);
      const receipt = await waitTx(tx, hre.network);
      console.log(`${GRN}✅ confirmed${RST} – gas used ${receipt.gasUsed.toString()}`);
    }

  } catch (err) {
    console.error(`${RED}✖ ${err.message}${RST}`);
    process.exit(1);
  }
})();

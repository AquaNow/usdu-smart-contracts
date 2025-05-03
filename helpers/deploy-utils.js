/**
 * Returns the # of block confirmations to wait for a given chain-id.
 * Extend this switch if you add more networks.
 */
function confirmationsFor(chainId) {
    switch (chainId) {
        case 1:          // Ethereum mainnet
            return 2;
        case 11155111:   // Sepolia
            return 2;
        default:         // local / test / others
            return 1;
    }
}

/**
 * Wait for the right # of confirmations.
 * Usage:  await waitTx(contract.function(), network);
 */
async function waitTx(txPromise, network) {
    const tx = await txPromise;
    const conf = confirmationsFor(network.config.chainId);
    console.log(`Waiting for ${conf} confirmations…`);
    return tx.wait(conf);
}

/**
 * Verifies a contract on Etherscan.
 *
 * @param {string} address            Proxy or implementation address
 * @param {object} hre                Hardhat Runtime Env
 * @param {Array<any>} constructorArgs  Constructor args, default []
 * @param {string=} contractPath      Optional fully-qualified contract path
 *
 * Usage examples:
 *   await verify(impl, hre);                                    // autodetect
 *   await verify(impl, hre, [], "contracts/Token.sol:Token");   // explicit
 */
async function verify(address, hre, constructorArgs = [], contractPath) {
    console.log(`🔍  Verifying ${address} …`);
    // Build param object dynamically
    const params = {
        address,
        constructorArguments: constructorArgs,
    };
    if (contractPath) params.contract = contractPath;

    try {
        await hre.run("verify:verify", params);
        console.log("✓ verified");
    } catch (err) {
        if (err.message.toLowerCase().includes("already verified")) {
            console.log("✓ already verified");
        } else {
            console.warn(`⚠️  verification failed: ${err.message}`);
        }
    }
}

// Throw-on-missing env-var helper -------------------------------------------
function requireEnv(varName) {
    const value = process.env[varName];
    if (value && value.trim() !== "") return value.trim();

    // Allow missing values *at compile-time*; enforce at runtime.
    if (process.env.HARDHAT_NETWORK === "hardhat" || process.env.NODE_ENV === "test") {
        return "";
    }

    throw new Error(`[config] Environment variable ${varName} is required but not set.`);
}

module.exports = { confirmationsFor, waitTx, verify, requireEnv };

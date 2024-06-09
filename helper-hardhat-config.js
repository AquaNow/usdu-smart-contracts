const networkConfig = {
    31337: {
        name: "localhost",
        confirmations: 1,
        minterAllowance: "50000000000000"
    },
    11155111: {
        name: "sepolia",
        confirmations: 2,
        minterAllowance: "50000000000000"
    }
}

const developmentChains = ["hardhat", "localhost"];
const VERIFICATION_BLOCK_CONFIRMATIONS = 6;

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
};
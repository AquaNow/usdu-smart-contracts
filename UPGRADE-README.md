# USDU Smart Contract Upgrade Guide

This document outlines the process for upgrading the USDU smart contracts, including TokenV1 and MasterMinter contracts.

## Overview

This branch contains test utilities and processes to safely validate and implement upgrades to the USDU smart contracts. The validation process ensures that storage layouts remain compatible between versions, preventing data corruption during upgrades.

## Upgrade Process

### Phase 1: Preparation and Setup

1. **Archive Current Version**

   Before making any changes, archive the current contract state:

   ```bash
   # If you have deployed to a local network
   npx hardhat run scripts/archive-current-version.js --network localhost
   
   # For testnet
   npx hardhat run scripts/archive-current-version.js --network sepolia
   
   # For mainnet (ensure you have the correct proxy addresses)
   npx hardhat run scripts/archive-current-version.js --network mainnet
   ```

   This will:
   - Create an archive directory at `deployments/archive/v1/<network>/`
   - Save proxy and implementation addresses
   - Store contract ABIs
   - Export the storage layout for validation

2. **Set Environment Variables**

   If you need to specify proxy addresses manually:

   ```bash
   export TOKEN_PROXY_ADDRESS=0x...
   export MASTERMINTER_PROXY_ADDRESS=0x...
   ```

### Phase 2: Implementation

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/<feature-name>
   ```

2. **Modify Contracts**

   Make necessary changes to the contract code, ensuring:
   - New state variables are added at the end of the contract
   - Existing storage variables and their order remain unchanged
   - The storage gap is properly adjusted to account for new variables
   - No existing functionality is broken

3. **Validate Storage Layout**

   Run the validation script to ensure your changes are compatible with the deployed contracts:

   ```bash
   npx hardhat run scripts/validate-upgrade.js --network <network>
   ```

4. **Run Automated Tests**

   The test suite includes special validation tests that use archived deployment data to verify upgrade safety:

   ```bash
   npx hardhat test
   ```

   Key test files to check:
   - `test/CountersImplementation.test.js`
   - `test/FullUpgrade.test.js`
   - `test/TokenUpgradeable.test.js`
   - `test/MasterMinterUpgradeable.test.js`

### Phase 3: Upgrade

1. **Run the Upgrade Script**

   After validating the changes:

   ```bash
   # For TokenV1 upgrades
   npx hardhat run scripts/upgrade-tokenv1.js --network <network>
   
   # For MasterMinter upgrades
   npx hardhat run scripts/upgrade-masterminter.js --network <network>
   ```

   Both scripts include:
   - Automatic validation before upgrading
   - Robust error handling with helpful diagnostic messages
   - Verification of transaction success
   - Archiving of upgrade details for future reference

2. **Verify Post-Upgrade**

   Run tests to ensure the new functionality works as expected:

   ```bash
   # Run specific upgrade tests
   npx hardhat test test/FullUpgrade.test.js
   
   # Or run specific contract tests
   npx hardhat test test/TokenV1UserFunctions.test.js
   ```

## Upgrade Validation Testing

### Test Architecture

The test files have been structured to validate upgrades against:

1. **Archived Deployments**: Tests first look for archived versions of contracts in the `deployments/archive` directory and validate that upgrades are safe from these previously deployed contracts.

2. **Current Test Instances**: If no archived data is found, tests fall back to validating upgrades from the current test instances.

### Key Test Files

- `CountersImplementation.test.js`: Tests for counters in both TokenV1 and MasterMinter, validating that counters persist through upgrades
- `FullUpgrade.test.js`: End-to-end tests of the full upgrade process for both contracts
- `TokenUpgradeable.test.js`: Detailed tests for TokenV1 upgrades, focusing on initialization, functionality changes, and memory/state preservation
- `MasterMinterUpgradeable.test.js`: Tests for MasterMinter upgrades with focus on initialization and administrative functionality

### Running Validation Tests

```bash
# Run all tests
npx hardhat test

# Run specific upgrade tests
npx hardhat test test/CountersImplementation.test.js
```

## Storage Layout Changes

When making changes to contracts, follow these guidelines:

1. Only add new state variables at the end of the contract
2. Do not change the order or type of existing variables
3. Adjust the `__gap` array size to maintain the same total storage slot usage
4. Document all changes to storage layout in your PR

## Important Notes

- All contract upgrades must preserve existing functionality
- Upgrades must be backward compatible with existing applications and integrations
- Always run full test suite before performing an upgrade on mainnet
- After upgrading, monitor the contract for any unexpected behavior 
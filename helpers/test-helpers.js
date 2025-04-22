/**
 * Test helpers for USDU smart contract tests
 * Maps signer accounts to roles in a consistent way across test files
 */

// Role mapping consistent with Fireblocks vault structure
const ROLES = {
  OWNER: 0,          // FB Vault ID 15: USDU Contract Owner
  MINTING_ADMIN: 1,  // FB Vault ID 16: USDU Contract Admin - Minting
  OPERATIONS: 2,     // FB Vault ID 18: USDU Contract Admin - Operations
  SECURITY: 3,       // FB Vault ID 17: USDU Contract Admin - Security
  PORTAL: 6,         // FB Vault ID 19: USDU Portal Interface
  TREASURY: 7,       // FB Vault ID 20: USDU Treasury
  EXTRA_CONTROLLER: 6,
  EXTRA_MINTER: 7,
  USER_1: 8,
  USER_2: 9,
  USER_3: 10,
  BLACKLISTED_USER: 11,
  NEW_OWNER: 12,
  RANDOM: 13
};

/**
 * Setup test accounts with proper roles
 * @param {Array} signers - Array of ethers signers
 * @returns {Object} Mapped accounts by role
 */
function setupTestAccounts(signers) {
  return {
    owner: signers[ROLES.OWNER],
    mintingAdmin: signers[ROLES.MINTING_ADMIN],
    security: signers[ROLES.SECURITY],
    operations: signers[ROLES.OPERATIONS],
    portal: signers[ROLES.PORTAL],
    treasury: signers[ROLES.TREASURY],
    extraController: signers[ROLES.EXTRA_CONTROLLER],
    extraMinter: signers[ROLES.EXTRA_MINTER],
    user1: signers[ROLES.USER_1],
    user2: signers[ROLES.USER_2],
    user3: signers[ROLES.USER_3],
    blacklistedUser: signers[ROLES.BLACKLISTED_USER],
    newOwner: signers[ROLES.NEW_OWNER],
    random: signers[ROLES.RANDOM],
    // For backward compatibility with existing tests
    pauser: signers[ROLES.SECURITY],
    blacklister: signers[ROLES.SECURITY],
    rescuer: signers[ROLES.SECURITY],
    minter: signers[ROLES.OPERATIONS],
    controllerAdmin: signers[ROLES.MINTING_ADMIN]
  };
}

/**
 * Get a mapping of old role names to new account indices
 * For migrating existing tests without changing all variable names
 */
function getLegacyRoleMapping() {
  return {
    owner: ROLES.OWNER,
    permissionAdmin: ROLES.SECURITY,
    controllerAdmin: ROLES.MINTING_ADMIN,
    blacklister: ROLES.SECURITY,
    pauser: ROLES.SECURITY,
    controller1: ROLES.OPERATIONS,
    controller2: ROLES.EXTRA_CONTROLLER,
    minter1: ROLES.OPERATIONS,
    minter2: ROLES.PORTAL,
    minter3: ROLES.EXTRA_MINTER,
    rescuer: ROLES.SECURITY
  };
}

module.exports = {
  ROLES,
  setupTestAccounts,
  getLegacyRoleMapping
}; 
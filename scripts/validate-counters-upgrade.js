// SPDX-License-Identifier: MIT
const fs = require('fs-extra');
const path = require('path');
const { ethers, upgrades, network } = require('hardhat');

/**
 * Validates that the modified Controller and Blacklistable contracts are compatible with the deployed proxies
 * This ensures that the upgrade is safe and won't corrupt storage
 */
async function main() {
  console.log(`Validating counters upgrade on network: ${network.name}`);
  
  // Define the archive directory path
  const archiveDir = path.join(
    __dirname,
    '..',
    'deployments',
    'archive',
    'v1',
    network.name
  );

  // Check if we have archived contract data
  const tokenArchivePath = path.join(archiveDir, 'TokenV1.json');
  if (!fs.existsSync(tokenArchivePath)) {
    console.error(`ERROR: No archived TokenV1 data found at ${tokenArchivePath}`);
    console.error('Please run archive-current-version.js first');
    process.exit(1);
  }
  
  // Load archived contract data
  const tokenData = require(tokenArchivePath);
  const tokenProxyAddress = tokenData.proxyAddress;
  
  console.log(`TokenV1 Proxy Address: ${tokenProxyAddress}`);
  
  // Get contract factory for the modified TokenV1
  const TokenV1 = await ethers.getContractFactory('TokenV1');
  
  try {
    // Validate the upgrade
    console.log('Validating TokenV1 storage layout compatibility...');
    await upgrades.validateUpgrade(tokenProxyAddress, TokenV1, {
      unsafeAllow: ['delegatecall'],
      unsafeAllowCustomTypes: true
    });
    
    console.log('✅ TokenV1 upgrade validation successful!');
    console.log('The modified TokenV1 contract with blacklisted counter is compatible with the deployed proxy.');
    
    // Now validate Controller upgrade if needed
    const masterMinterArchivePath = path.join(archiveDir, 'MasterMinter.json');
    if (fs.existsSync(masterMinterArchivePath)) {
      const masterMinterData = require(masterMinterArchivePath);
      const masterMinterProxyAddress = masterMinterData.proxyAddress;
      
      console.log(`MasterMinter Proxy Address: ${masterMinterProxyAddress}`);
      
      // Get contract factory
      const MasterMinter = await ethers.getContractFactory('MasterMinter');
      
      console.log('Validating MasterMinter storage layout compatibility...');
      await upgrades.validateUpgrade(masterMinterProxyAddress, MasterMinter, {
        unsafeAllow: ['delegatecall'],
        unsafeAllowCustomTypes: true
      });
      
      console.log('✅ MasterMinter upgrade validation successful!');
      console.log('The modified MasterMinter contract with controller counter is compatible with the deployed proxy.');
    }
  } catch (error) {
    console.error('❌ Upgrade validation failed:');
    console.error(error.message);
    
    // Check for common errors and provide helpful messages
    if (error.message.includes('incompatible with its previous version')) {
      console.log('\nStorage incompatibility detected. Check the following:');
      console.log('1. Ensure you have not changed the order of existing state variables');
      console.log('2. Ensure you have only added new variables at the end');
      console.log('3. Ensure you have properly adjusted the __gap array size');
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
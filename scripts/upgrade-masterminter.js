// SPDX-License-Identifier: MIT
const fs = require('fs-extra');
const path = require('path');
const { ethers, upgrades, network } = require('hardhat');

/**
 * Upgrades the MasterMinter proxy with the new implementation
 */
async function main() {
  console.log(`Upgrading MasterMinter contract on network: ${network.name}`);
  
  try {
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Using deployer account: ${deployer.address}`);
    
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
    const masterMinterArchivePath = path.join(archiveDir, 'MasterMinter.json');
    if (!fs.existsSync(masterMinterArchivePath)) {
      throw new Error(`No archived MasterMinter data found at ${masterMinterArchivePath}. Please run archive-current-version.js first.`);
    }
    
    // Load archived contract data
    const masterMinterData = require(masterMinterArchivePath);
    const masterMinterProxyAddress = masterMinterData.proxyAddress;
    
    if (!ethers.utils.isAddress(masterMinterProxyAddress)) {
      throw new Error(`Invalid MasterMinter proxy address: ${masterMinterProxyAddress}`);
    }
    
    console.log(`MasterMinter Proxy Address: ${masterMinterProxyAddress}`);
    
    // Get contract factory for the MasterMinter
    const MasterMinter = await ethers.getContractFactory('MasterMinter', deployer);
    
    // Validate the upgrade
    console.log('Validating storage layout compatibility...');
    await upgrades.validateUpgrade(masterMinterProxyAddress, MasterMinter, {
      unsafeAllow: ['delegatecall'],
    });
    
    console.log('Upgrade validation successful!');
    
    // Execute the upgrade
    console.log('Executing upgrade...');
    const upgraded = await upgrades.upgradeProxy(masterMinterProxyAddress, MasterMinter, {
      unsafeAllow: ['delegatecall'],
    });
    
    // Wait for deployment to complete
    const receipt = await upgraded.deployTransaction.wait();
    if (receipt.status !== 1) {
      throw new Error('Transaction failed during contract upgrade');
    }
    
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(
      upgraded.address
    );
    
    console.log(`✅ Proxy address (unchanged): ${upgraded.address}`);
    console.log(`✅ New implementation address: ${newImplementationAddress}`);
    console.log(`✅ Transaction hash: ${upgraded.deployTransaction.hash}`);
    console.log('Upgrade completed successfully!');
    
    // Archive the new implementation version
    console.log('Archiving new implementation details...');
    
    const upgradeDir = path.join(
      __dirname,
      '..',
      'deployments',
      'archive',
      'v1.1',
      network.name
    );
    
    await fs.ensureDir(upgradeDir);
    
    // Archive MasterMinter data with new implementation
    const updatedMasterMinterData = {
      proxyAddress: upgraded.address,
      implementationAddress: newImplementationAddress,
      upgrade: {
        date: new Date().toISOString(),
        transactionHash: upgraded.deployTransaction.hash,
        deployer: deployer.address,
        features: [
          'Added numberOfControllers counter',
          'Enhanced controller management',
          'Improved gas efficiency'
        ]
      }
    };
    
    await fs.writeJSON(
      path.join(upgradeDir, 'MasterMinter-upgraded.json'),
      updatedMasterMinterData,
      { spaces: 2 }
    );
    
    console.log(`Upgrade details saved to: ${path.join(upgradeDir, 'MasterMinter-upgraded.json')}`);
  } catch (error) {
    console.error('❌ Upgrade failed:');
    console.error(error.message);
    
    // Provide more detailed error information if available
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    
    if (error.receipt) {
      console.error(`Transaction hash: ${error.receipt.transactionHash}`);
      console.error(`Gas used: ${error.receipt.gasUsed.toString()}`);
    }
    
    // Suggest possible solutions based on error
    if (error.message.includes('storage')) {
      console.error('\nPossible storage layout incompatibility. Please check:');
      console.error('1. Ensure you haven\'t modified existing storage variables');
      console.error('2. Check that new variables are added at the end');
      console.error('3. Verify the storage gap is correctly adjusted');
    }
    
    if (error.message.includes('execution reverted')) {
      console.error('\nTransaction reverted. Possible causes:');
      console.error('1. Insufficient permissions (caller is not owner)');
      console.error('2. Contract is paused or locked');
      console.error('3. Implementation has initialization problems');
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:');
    console.error(error);
    process.exit(1);
  }); 
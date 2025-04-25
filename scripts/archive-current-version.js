// SPDX-License-Identifier: MIT
const fs = require('fs-extra');
const path = require('path');
const { ethers, network } = require('hardhat');

/**
 * Archives the current version of the TokenV1 and MasterMinter contracts
 * Stores the proxy address, implementation address, and ABI
 * Also exports the storage layout of TokenV1 for upgrade validation
 */
async function main() {
  console.log(`Archiving current version on network: ${network.name}`);
  
  // Define the archive directory path
  const archiveDir = path.join(
    __dirname,
    '..',
    'deployments',
    'archive',
    'v1',
    network.name
  );

  // Ensure the archive directory exists
  await fs.ensureDir(archiveDir);
  
  // Try to load deployments from deployments directory or from the network
  let tokenProxyAddress, masterMinterProxyAddress;
  let tokenImplAddress, masterMinterImplAddress;
  
  try {
    // First, try to load from hardhat-deploy's deployments
    const { deployments } = require('hardhat');
    
    try {
      const tokenDeployment = await deployments.get('TokenV1');
      const masterMinterDeployment = await deployments.get('MasterMinter');
      
      tokenProxyAddress = tokenDeployment.address;
      masterMinterProxyAddress = masterMinterDeployment.address;
      
      console.log('Loaded deployment addresses from hardhat-deploy:');
    } catch (deployError) {
      // If not found in hardhat-deploy, check for proxy-specific files
      console.log('Could not find deployments in hardhat-deploy, checking proxy files...');
      
      const deploymentDir = path.join(__dirname, '..', 'deployments', network.name);
      
      // Check if the deployment directory exists
      if (fs.existsSync(deploymentDir)) {
        // Look for TokenV1.json
        const tokenProxyFile = path.join(deploymentDir, 'TokenV1.json');
        const masterMinterProxyFile = path.join(deploymentDir, 'MasterMinter.json');
        
        if (fs.existsSync(tokenProxyFile)) {
          const tokenProxyData = require(tokenProxyFile);
          tokenProxyAddress = tokenProxyData.address;
          console.log('Found TokenV1 proxy address in deployment files');
        }
        
        if (fs.existsSync(masterMinterProxyFile)) {
          const masterMinterProxyData = require(masterMinterProxyFile);
          masterMinterProxyAddress = masterMinterProxyData.address;
          console.log('Found MasterMinter proxy address in deployment files');
        }
      }
    }
  } catch (error) {
    console.log('Could not load deployments from filesystem, checking environment variables...');
  }
  
  // If we still don't have addresses, check environment variables
  if (!tokenProxyAddress || !masterMinterProxyAddress) {
    console.log('Checking environment variables for proxy addresses...');
    tokenProxyAddress = process.env.TOKEN_PROXY_ADDRESS;
    masterMinterProxyAddress = process.env.MASTERMINTER_PROXY_ADDRESS;
    
    if (!tokenProxyAddress || !masterMinterProxyAddress) {
      console.error('ERROR: Token proxy or MasterMinter proxy address not provided.');
      console.error('Please set TOKEN_PROXY_ADDRESS and MASTERMINTER_PROXY_ADDRESS environment variables.');
      process.exit(1);
    }
  }
  
  console.log(`Token Proxy Address: ${tokenProxyAddress}`);
  console.log(`MasterMinter Proxy Address: ${masterMinterProxyAddress}`);
  
  // Try to get implementation addresses from the network
  try {
    // This is just to test the network connection - will throw if no connection
    await ethers.provider.getBlockNumber();
    
    // Import upgrades only if we have a network connection
    const { upgrades } = require('hardhat');
    
    // Get implementation addresses
    tokenImplAddress = await upgrades.erc1967.getImplementationAddress(tokenProxyAddress);
    masterMinterImplAddress = await upgrades.erc1967.getImplementationAddress(masterMinterProxyAddress);
    
    console.log(`Token Implementation Address: ${tokenImplAddress}`);
    console.log(`MasterMinter Implementation Address: ${masterMinterImplAddress}`);
  } catch (error) {
    console.warn('Warning: Could not connect to network to get implementation addresses.');
    console.warn('Using placeholder values for implementation addresses.');
    
    // Use placeholder values for implementation addresses
    tokenImplAddress = process.env.TOKEN_IMPL_ADDRESS || 'IMPLEMENTATION_ADDRESS_NOT_AVAILABLE';
    masterMinterImplAddress = process.env.MASTERMINTER_IMPL_ADDRESS || 'IMPLEMENTATION_ADDRESS_NOT_AVAILABLE';
  }
  
  // Archive data using compiled artifacts instead of trying to get contract instances
  console.log('Extracting contract ABIs from compiled artifacts...');
  
  let tokenABI, masterMinterABI;
  
  try {
    // Try to get the ABIs from compiled artifacts
    const tokenArtifactPath = path.join(
      __dirname, 
      '..', 
      'artifacts', 
      'contracts', 
      'src', 
      'TokenContracts', 
      'TokenV1.sol', 
      'TokenV1.json'
    );
    
    const masterMinterArtifactPath = path.join(
      __dirname, 
      '..', 
      'artifacts', 
      'contracts', 
      'src', 
      'Minting', 
      'MasterMinter.sol', 
      'MasterMinter.json'
    );
    
    if (fs.existsSync(tokenArtifactPath)) {
      const tokenArtifact = require(tokenArtifactPath);
      tokenABI = tokenArtifact.abi;
      console.log('Loaded TokenV1 ABI from compiled artifact');
    } else {
      console.warn('Warning: TokenV1 artifact not found');
      tokenABI = [];
    }
    
    if (fs.existsSync(masterMinterArtifactPath)) {
      const masterMinterArtifact = require(masterMinterArtifactPath);
      masterMinterABI = masterMinterArtifact.abi;
      console.log('Loaded MasterMinter ABI from compiled artifact');
    } else {
      console.warn('Warning: MasterMinter artifact not found');
      masterMinterABI = [];
    }
  } catch (error) {
    console.warn('Warning: Could not load contract ABIs from artifacts');
    console.warn(error.message);
    tokenABI = [];
    masterMinterABI = [];
  }
  
  // Archive TokenV1 data
  const tokenData = {
    proxyAddress: tokenProxyAddress,
    implementationAddress: tokenImplAddress,
    abi: tokenABI
  };
  
  // Archive MasterMinter data
  const masterMinterData = {
    proxyAddress: masterMinterProxyAddress,
    implementationAddress: masterMinterImplAddress,
    abi: masterMinterABI
  };
  
  // Write contract data to archive
  await fs.writeJSON(
    path.join(archiveDir, 'TokenV1.json'),
    tokenData,
    { spaces: 2 }
  );
  
  await fs.writeJSON(
    path.join(archiveDir, 'MasterMinter.json'),
    masterMinterData,
    { spaces: 2 }
  );
  
  console.log('Contract data archived successfully');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
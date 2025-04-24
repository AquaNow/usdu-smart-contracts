const { ethers, upgrades } = require("hardhat");

async function upgradeContract(proxyAddress, newImplementationFactory, options = {}) {
    const upgraded = await upgrades.upgradeProxy(
        proxyAddress, 
        newImplementationFactory,
        {
            unsafeAllow: ['delegatecall'],
            unsafeAllowCustomTypes: true,
            ...options
        }
    );
    
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(upgraded.address);
    
    return {
        proxy: upgraded,
        implementationAddress: newImplementationAddress
    };
}

module.exports = {
    upgradeContract
}; 
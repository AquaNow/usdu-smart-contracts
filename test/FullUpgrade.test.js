const { expect } = require("chai");
const { ethers, deployments, network, upgrades } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { upgradeContract } = require("../scripts/test-upgrade");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Full Upgrade Integration Test", function () {
      let tokenv1, masterMinter, owner, minter, user;
      const initialMintAmount = 1000;

      before(async () => {
        await deployments.fixture(["all"]);
        
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        minter = accounts[1];
        user = accounts[2];

        // Get deployed contract instances
        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);
        
        // Configure controller and minter
        await masterMinter.setControllerAdmin(owner.address);
        await masterMinter.configureController(owner.address, minter.address);
        await masterMinter.configureMinter(minter.address, initialMintAmount);
        
        // Mint some tokens before upgrade
        await tokenv1.connect(minter).mint(minter.address, 500);
      });

      it("should maintain state when upgrading TokenV1", async () => {
        // Check initial state
        const initialBalance = await tokenv1.balanceOf(minter.address);
        expect(initialBalance).to.equal(500);
        
        // Get the TokenV2 factory (for this test we're using the same contract as an example)
        const TokenV2 = await ethers.getContractFactory("TokenV1");
        
        // Perform upgrade
        const result = await upgradeContract(tokenv1.address, TokenV2);
        const upgradedToken = result.proxy;
        
        // Verify state is maintained
        const postUpgradeBalance = await upgradedToken.balanceOf(minter.address);
        expect(postUpgradeBalance).to.equal(initialBalance);
        
        // Verify we can still use the contract
        await upgradedToken.connect(minter).transfer(user.address, 100);
        expect(await upgradedToken.balanceOf(user.address)).to.equal(100);
      });

      it("should maintain state when upgrading MasterMinter", async () => {
        // Check initial state - minter should be configured
        expect(await masterMinter.isMinter(minter.address)).to.equal(true);
        
        // Get the factory (using same contract as example)
        const MasterMinterV2 = await ethers.getContractFactory("MasterMinter");
        
        // Perform upgrade
        const result = await upgradeContract(masterMinter.address, MasterMinterV2);
        const upgradedMasterMinter = result.proxy;
        
        // Verify state is maintained
        expect(await upgradedMasterMinter.isMinter(minter.address)).to.equal(true);
        
        // Verify we can still use the contract
        expect(await tokenv1.minterAllowance(minter.address)).to.equal(500); // 1000 initial - 500 minted
        await upgradedMasterMinter.connect(owner).configureMinter(minter.address, 2000);
        expect(await tokenv1.minterAllowance(minter.address)).to.equal(2000);
      });

      it("should handle a full end-to-end scenario with both contracts upgraded", async () => {
        // Get both factory instances (using same contracts as example)
        const TokenV2 = await ethers.getContractFactory("TokenV1");
        const MasterMinterV2 = await ethers.getContractFactory("MasterMinter");
        
        // Perform both upgrades
        const tokenResult = await upgradeContract(tokenv1.address, TokenV2);
        const upgradedToken = tokenResult.proxy;
        
        const minterResult = await upgradeContract(masterMinter.address, MasterMinterV2);
        const upgradedMasterMinter = minterResult.proxy;
        
        // Verify the system still functions correctly
        await upgradedMasterMinter.configureMinter(minter.address, 3000);
        await upgradedToken.connect(minter).mint(minter.address, 1000);
        
        // Check balances
        const finalBalance = await upgradedToken.balanceOf(minter.address);
        expect(finalBalance).to.be.gt(1000); // Should be at least 1000 (the new mint)
        
        // Verify transfer still works
        await upgradedToken.connect(minter).transfer(user.address, 200);
        expect(await upgradedToken.balanceOf(user.address)).to.equal(300); // 100 from previous + 200 new
      });
    }); 
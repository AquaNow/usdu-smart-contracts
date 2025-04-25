const { assert, expect } = require("chai");
const { ethers, upgrades, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");
const path = require("path");
const fs = require("fs-extra");

const args = [
  "USD Universal",
  "USDU",
  "USD",
  6,
  "0xb9fB8ebE83Ff016D2F861Aad3c2Bc1EF5DB2ce08",
  "0xf55e3f071dc374588954FC13A20527233b2cFE09",
  "0x2B51E57004572e9A13f092EC87e201bFEe2F7fe0",
  "0x1234567890abcdef1234567890abcdef12345678",  
];

const opts = {
  unsafeAllowCustomTypes: true,
  unsafeAllow: ['delegatecall'],
  initializer: `initializeToken(string memory tokenName, string memory tokenSymbol, string memory tokenCurrency, uint8 tokenDecimals, address newMasterMinter, address newPauser, address newBlacklister, address newRescuer)`,
};

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Token Upgradeable Tests", function () {
      let accounts;
      let tokenProxyAddress;

      before(async () => {
        const signers = await ethers.getSigners();
        accounts = setupTestAccounts(signers);
        
        // Try to load archive data for previous deployments
        const archiveDir = path.join(
          __dirname,
          '..',
          'deployments',
          'archive',
          'v1',
          network.name
        );
        
        try {
          if (fs.existsSync(path.join(archiveDir, 'TokenV1.json'))) {
            const tokenArchiveData = require(path.join(archiveDir, 'TokenV1.json'));
            tokenProxyAddress = tokenArchiveData.proxyAddress;
            console.log(`Found archived TokenV1 deployment at: ${tokenProxyAddress}`);
          }
        } catch (error) {
          console.log(`Archive data not found or could not be loaded: ${error.message}`);
        }
      });

      describe("Token Upgrade Initialization Check", function () {
        let upgraded, instance;
        before(async () => {
          const TokenV1 = await ethers.getContractFactory("TokenV1");
          const TokenV2 = await ethers.getContractFactory("TokenV1");

          instance = await upgrades.deployProxy(TokenV1, args, opts);
          
          // Validate upgrade with archive data if available
          if (tokenProxyAddress) {
            console.log(`Validating upgrade from archived TokenV1 at ${tokenProxyAddress}`);
            await upgrades.validateUpgrade(tokenProxyAddress, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            // Fall back to validating with current instance
            console.log('No archived TokenV1 found, validating with current instance');
            await upgrades.validateUpgrade(instance.address, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          }
          
          upgraded = await upgrades.upgradeProxy(instance.address, TokenV2, {
            unsafeAllow: ['delegatecall']
          });
        });

        it("should upgrade token to proper new version", async () => {
          const name = await upgraded.name();
          const symbol = await upgraded.symbol();
          const currency = await upgraded.currency();
          const decimals = await upgraded.decimals();
          const masterMinter = await upgraded.masterMinter();
          const paused = await upgraded.paused();
          const blacklisted = await upgraded.isBlacklisted("0x2B51E57004572e9A13f092EC87e201bFEe2F7fe0");

          expect(name.toString()).to.equal("USD Universal");
          expect(symbol.toString()).to.equal("USDU");
          expect(currency.toString()).to.equal("USD");
          expect(decimals.toString()).to.equal("6");
          expect(masterMinter.toString()).to.equal("0xb9fB8ebE83Ff016D2F861Aad3c2Bc1EF5DB2ce08");
          expect(paused.toString()).to.equal("false");
          expect(blacklisted.toString()).to.equal("false");
        });

        it("should update owner properly", async () => {
          expect(await upgraded.getOwner()).to.equal(accounts.owner.address);
        });
      });

      describe("Token Upgrade Implement Change Check", function () {
        let upgraded, instance;
        before(async () => {
          const TokenV2 = await ethers.getContractFactory("TokenV2");
          const TokenV1 = await ethers.getContractFactory("TokenV1");

          instance = await upgrades.deployProxy(TokenV1, args, opts);
          
          // Validate upgrade with archive data if available
          if (tokenProxyAddress) {
            console.log(`Validating TokenV2 upgrade from archived TokenV1 at ${tokenProxyAddress}`);
            await upgrades.validateUpgrade(tokenProxyAddress, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            // Fall back to validating with current instance
            console.log('No archived TokenV1 found, validating with current instance');
            await upgrades.validateUpgrade(instance.address, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          }
          
          upgraded = await upgrades.upgradeProxy(instance.address, TokenV2, {
            unsafeAllow: ['delegatecall']
          });
        });

        it("should upgrade token to proper new version", async () => {
          const decimalsUpgraded = await upgraded.decimals();
          const decimalsOldContract = await instance.decimals();

          expect(decimalsUpgraded.toString()).to.equal("2");
          expect(decimalsOldContract.toString()).to.equal("2");
        });

        it("should update owner properly", async () => {
          expect(await upgraded.getOwner()).to.equal(accounts.owner.address);
        });
      });

      describe("Token Upgrade Memory Check (need to be masterMinter)", function () {
        let oldContract;
        const initialBalance = 20;

        beforeEach(async () => {
          const TokenV1 = await ethers.getContractFactory("TokenV1");
          const MasterMinter = await ethers.getContractFactory("MasterMinter");

          const masterMinter = await MasterMinter.deploy();

          oldContract = await upgrades.deployProxy(
            TokenV1,
            [
              "USD Universal",
              "USDU",
              "USD",
              6,
              masterMinter.address,
              "0xf55e3f071dc374588954FC13A20527233b2cFE09",
              "0x2B51E57004572e9A13f092EC87e201bFEe2F7fe0",
              "0x1234567890abcdef1234567890abcdef12345678"  
            ],
            opts
          );

          oldContract.setPermissionAdmin(accounts.security.address);

          await masterMinter.initializeMintController(oldContract.address, 4);
          await masterMinter.connect(accounts.owner).setControllerAdmin(accounts.mintingAdmin.address);
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.operations.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.operations.address, initialBalance);
        });

        it("should validate upgrade compatibility with archive data if available", async () => {
          const TokenV2 = await ethers.getContractFactory("TokenV1");
          
          // Validate upgrade with archive data if available
          if (tokenProxyAddress) {
            console.log(`Validating upgrade from archived TokenV1 at ${tokenProxyAddress}`);
            await upgrades.validateUpgrade(tokenProxyAddress, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            // Fall back to validating with old contract
            console.log('No archived TokenV1 found, validating with test contract');
            await upgrades.validateUpgrade(oldContract.address, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          }
        });

        it("should update initial memory properly", async () => {
          const TokenV2 = await ethers.getContractFactory("TokenV1");
          
          // Validate upgrade with archive data if available
          if (tokenProxyAddress) {
            console.log(`Validating upgrade from archived TokenV1 at ${tokenProxyAddress}`);
            await upgrades.validateUpgrade(tokenProxyAddress, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            // Fall back to validating with old contract
            await upgrades.validateUpgrade(oldContract.address, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          }
          
          upgraded = await upgrades.upgradeProxy(oldContract.address, TokenV2, {
            unsafeAllow: ['delegatecall']
          });

          expect(await oldContract.getPermissionAdmin()).to.equal(accounts.security.address);
          expect(await upgraded.getPermissionAdmin()).to.equal(await oldContract.getPermissionAdmin());

          expect(await oldContract.totalSupply()).to.equal(0);
          expect(await upgraded.totalSupply()).to.equal(await oldContract.totalSupply());

          expect(await oldContract.balanceOf(accounts.operations.address)).to.equal(0);
          expect(await upgraded.balanceOf(accounts.operations.address)).to.equal(0);
        });

        it("should update mint memory properly", async () => {
          const mintAmount = 4;
          const tx = await oldContract.connect(accounts.operations).mint(accounts.operations.address, mintAmount);
          await tx.wait();

          const TokenV2 = await ethers.getContractFactory("TokenV1");
          
          // Validate upgrade with archive data if available
          if (tokenProxyAddress) {
            console.log(`Validating upgrade from archived TokenV1 at ${tokenProxyAddress}`);
            await upgrades.validateUpgrade(tokenProxyAddress, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            // Fall back to validating with old contract
            await upgrades.validateUpgrade(oldContract.address, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          }
          
          upgraded = await upgrades.upgradeProxy(oldContract.address, TokenV2, {
            unsafeAllow: ['delegatecall']
          });

          expect(await oldContract.getPermissionAdmin()).to.equal(accounts.security.address);
          expect(await upgraded.getPermissionAdmin()).to.equal(await oldContract.getPermissionAdmin());

          expect(await oldContract.totalSupply()).to.equal(mintAmount);
          expect(await upgraded.totalSupply()).to.equal(await oldContract.totalSupply());

          expect(await oldContract.balanceOf(accounts.operations.address)).to.equal(mintAmount);
          expect(await upgraded.balanceOf(accounts.operations.address)).to.equal(mintAmount);
        });

        it("should update burn memory properly", async () => {
          const mintAmount = 5;
          const mintTx = await oldContract.connect(accounts.operations).mint(accounts.operations.address, mintAmount);
          await mintTx.wait();

          const burnAmount = 4;
          const burnTx = await oldContract.connect(accounts.operations).burn(burnAmount);
          await burnTx.wait();

          const remainingAmount = mintAmount - burnAmount;
          const TokenV2 = await ethers.getContractFactory("TokenV1");
          
          // Validate upgrade with archive data if available
          if (tokenProxyAddress) {
            console.log(`Validating upgrade from archived TokenV1 at ${tokenProxyAddress}`);
            await upgrades.validateUpgrade(tokenProxyAddress, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            // Fall back to validating with old contract
            await upgrades.validateUpgrade(oldContract.address, TokenV2, {
              unsafeAllow: ['delegatecall']
            });
          }
          
          upgraded = await upgrades.upgradeProxy(oldContract.address, TokenV2, {
            unsafeAllow: ['delegatecall']
          });

          expect(await oldContract.getPermissionAdmin()).to.equal(accounts.security.address);
          expect(await upgraded.getPermissionAdmin()).to.equal(await oldContract.getPermissionAdmin());

          expect(await oldContract.totalSupply()).to.equal(remainingAmount);
          expect(await upgraded.totalSupply()).to.equal(await oldContract.totalSupply());

          expect(await oldContract.balanceOf(accounts.operations.address)).to.equal(remainingAmount);
          expect(await upgraded.balanceOf(accounts.operations.address)).to.equal(remainingAmount);
        });
      });
    });

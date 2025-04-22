const { assert, expect } = require("chai");
const { ethers, deployments, network, upgrades } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("TokenV1 and MasterMinter Setup Tests", function () {
      let tokenv1, masterMinter;
      let accounts;
      const maxNumberOfMinters = 6;

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const signers = await ethers.getSigners();
        accounts = setupTestAccounts(signers);

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, accounts.owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, accounts.owner);

        // set controller admin as non owner address for this test cases
        await masterMinter.setControllerAdmin(accounts.mintingAdmin.address);
      });

      describe("TokenV1 Initialization", function () {
        it("should set up TokenV1 properly", async () => {
          const name = await tokenv1.name();
          const symbol = await tokenv1.symbol();
          const currency = await tokenv1.currency();
          const decimals = await tokenv1.decimals();
          const masterMinterAddress = await tokenv1.masterMinter();
          const pauserAddress = await tokenv1.getPauser();
          const blacklisterAddress = await tokenv1.getBlacklister();
          const ownerAddress = await tokenv1.getOwner();
          const permissionAdminAddress = await tokenv1.getPermissionAdmin();

          assert.equal(name.toString(), "USD Universal");
          assert.equal(symbol.toString(), "USDU");
          assert.equal(currency.toString(), "USD");
          assert.equal(decimals.toString(), "6");
          assert.equal(masterMinterAddress.toString(), masterMinter.address);
          assert.equal(pauserAddress.toString(), accounts.security.address);
          assert.equal(blacklisterAddress.toString(), accounts.security.address);
          assert.equal(ownerAddress.toString(), accounts.owner.address);
          assert.equal(permissionAdminAddress.toString(), accounts.security.address);
        });
      });

      describe("MasterMinter Initialization", function () {
        it("should set up MasterMinter properly", async () => {
          const ownerMasterMinter = await masterMinter.getOwner();
          const maxMinters = await masterMinter.getMaxMinters();
          const minterManager = await masterMinter.getMinterManager();
          const masterMinterToken = await tokenv1.masterMinter();
          const controllerAdmin = await masterMinter.getControllerAdmin();

          assert.equal(ownerMasterMinter.toString(), accounts.owner.address);
          assert.equal(maxMinters.toString(), maxNumberOfMinters.toString());
          assert.equal(minterManager.toString(), tokenv1.address);
          assert.equal(masterMinterToken.toString(), masterMinter.address);
          assert.equal(controllerAdmin.toString(), accounts.mintingAdmin.address);
        });
      });

      describe("Minter Configuration", function () {
        it("should configure minter successfully", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.mintingAdmin.address, accounts.operations.address);
          await masterMinter.connect(accounts.mintingAdmin).configureMinter(accounts.operations.address, 1000);
          assert.equal(await masterMinter.isController(accounts.mintingAdmin.address), true);
          assert.equal(await masterMinter.isMinter(accounts.operations.address), true);

          await tokenv1.connect(accounts.operations).mint(accounts.operations.address, 1000);
          assert.equal(await tokenv1.balanceOf(accounts.operations.address), 1000);

          await tokenv1.connect(accounts.operations).transfer(accounts.random.address, 500);
          assert.equal(await tokenv1.balanceOf(accounts.random.address), 500);
        });
      });
    });

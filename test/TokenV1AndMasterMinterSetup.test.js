const { assert, expect } = require("chai");
const { ethers, deployments, network, upgrades } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("TokenV1 and MasterMinter Setup Tests", function () {
      let tokenv1, masterMinter, owner, admin, minter, blacklister, pauser, random;
      const maxNumberOfMinters = 6;

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        admin = accounts[1];
        minter = accounts[2];
        blacklister = accounts[3];
        pauser = accounts[4];
        random = accounts[5];

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);
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
          assert.equal(pauserAddress.toString(), pauser.address);
          assert.equal(blacklisterAddress.toString(), blacklister.address);
          assert.equal(ownerAddress.toString(), owner.address);
          assert.equal(permissionAdminAddress.toString(), owner.address);
        });
      });

      describe("MasterMinter Initialization", function () {
        it("should set up MasterMinter properly", async () => {
          const ownerMasterMinter = await masterMinter.getOwner();
          const maxMinters = await masterMinter.getMaxMinters();
          const minterManager = await masterMinter.getMinterManager();
          const masterMinterToken = await tokenv1.masterMinter();
          const controllerAdmin = await masterMinter.getControllerAdmin();

          assert.equal(ownerMasterMinter.toString(), owner.address);
          assert.equal(maxMinters.toString(), maxNumberOfMinters.toString());
          assert.equal(minterManager.toString(), tokenv1.address);
          assert.equal(masterMinterToken.toString(), masterMinter.address);
          assert.equal(controllerAdmin.toString(), owner.address);
        });
      });

      describe("Minter Configuration", function () {
        it("should configure minter successfully", async () => {
          assert.equal(await masterMinter.isController(owner.address), true);
          assert.equal(await masterMinter.isMinter(minter.address), true);

          await tokenv1.connect(minter).mint(minter.address, 1000);
          assert.equal(await tokenv1.balanceOf(minter.address), 1000);

          await tokenv1.connect(minter).transfer(random.address, 500);
          assert.equal(await tokenv1.balanceOf(random.address), 500);
        });
      });
    });

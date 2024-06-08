const { assert, expect } = require("chai");
const { ethers, upgrades, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

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
      let owner, permissionAdmin, controllerAdmin, controller1, minter1;

      before(async () => {
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        permissionAdmin = accounts[1];
        controllerAdmin = accounts[2];
        controller1 = accounts[3];
        minter1 = accounts[4];
      });

      describe("Token Upgrade Initialization Check", function () {
        let upgraded;
        before(async () => {
          const TokenV1 = await ethers.getContractFactory("TokenV1");
          const TokenV2 = await ethers.getContractFactory("TokenV1");

          const instance = await upgrades.deployProxy(TokenV1, args, opts);
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
          expect(await upgraded.getOwner()).to.equal(owner.address);
        });
      });

      describe("Token Upgrade Implement Change Check", function () {
        let upgraded, instance;
        before(async () => {
          const TokenV2 = await ethers.getContractFactory("TokenV2");
          const TokenV1 = await ethers.getContractFactory("TokenV1");

          instance = await upgrades.deployProxy(TokenV1, args, opts);
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
          expect(await upgraded.getOwner()).to.equal(owner.address);
        });
      });

      describe("Token Upgrade Memory Check (need to be masterMinter)", function () {
        let oldContract, upgraded;
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

          oldContract.setPermissionAdmin(permissionAdmin.address);

          await masterMinter.initializeMintController(oldContract.address, 4);
          await masterMinter.connect(owner).setControllerAdmin(controllerAdmin.address);
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, initialBalance);
        });

        it("should update initial memory properly", async () => {
          const TokenV2 = await ethers.getContractFactory("TokenV1");
          upgraded = await upgrades.upgradeProxy(oldContract.address, TokenV2, {
            unsafeAllow: ['delegatecall']
          });

          expect(await oldContract.getPermissionAdmin()).to.equal(permissionAdmin.address);
          expect(await upgraded.getPermissionAdmin()).to.equal(await oldContract.getPermissionAdmin());

          expect(await oldContract.totalSupply()).to.equal(0);
          expect(await upgraded.totalSupply()).to.equal(await oldContract.totalSupply());

          expect(await oldContract.balanceOf(minter1.address)).to.equal(0);
          expect(await upgraded.balanceOf(minter1.address)).to.equal(0);
        });

        it("should update mint memory properly", async () => {
          const mintAmount = 4;
          const tx = await oldContract.connect(minter1).mint(minter1.address, mintAmount);
          await tx.wait();

          const TokenV2 = await ethers.getContractFactory("TokenV1");
          upgraded = await upgrades.upgradeProxy(oldContract.address, TokenV2, {
            unsafeAllow: ['delegatecall']
          });

          expect(await oldContract.getPermissionAdmin()).to.equal(permissionAdmin.address);
          expect(await upgraded.getPermissionAdmin()).to.equal(await oldContract.getPermissionAdmin());

          expect(await oldContract.totalSupply()).to.equal(mintAmount);
          expect(await upgraded.totalSupply()).to.equal(await oldContract.totalSupply());

          expect(await oldContract.balanceOf(minter1.address)).to.equal(mintAmount);
          expect(await upgraded.balanceOf(minter1.address)).to.equal(mintAmount);
        });

        it("should update burn memory properly", async () => {
          const mintAmount = 5;
          const mintTx = await oldContract.connect(minter1).mint(minter1.address, mintAmount);
          await mintTx.wait();

          const burnAmount = 4;
          const burnTx = await oldContract.connect(minter1).burn(burnAmount);
          await burnTx.wait();

          const remainingAmount = mintAmount - burnAmount;
          const TokenV2 = await ethers.getContractFactory("TokenV1");
          upgraded = await upgrades.upgradeProxy(oldContract.address, TokenV2, {
            unsafeAllow: ['delegatecall']
          });

          expect(await oldContract.getPermissionAdmin()).to.equal(permissionAdmin.address);
          expect(await upgraded.getPermissionAdmin()).to.equal(await oldContract.getPermissionAdmin());

          expect(await oldContract.totalSupply()).to.equal(remainingAmount);
          expect(await upgraded.totalSupply()).to.equal(await oldContract.totalSupply());

          expect(await oldContract.balanceOf(minter1.address)).to.equal(remainingAmount);
          expect(await upgraded.balanceOf(minter1.address)).to.equal(remainingAmount);
        });
      });
    });

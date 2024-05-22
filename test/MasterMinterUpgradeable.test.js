const { expect } = require("chai");
const { ethers, upgrades, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("MasterMinter Upgradeable Tests", function () {
      let owner, trial, newAdmin, masterMinter, upgraded;

      before(async () => {
        [owner, trial, newAdmin] = await ethers.getSigners();
        const MasterMinter = await ethers.getContractFactory("MasterMinter");
        const MasterMinter2 = await ethers.getContractFactory("MasterMinter");

        masterMinter = await upgrades.deployProxy(
          MasterMinter,
          ["0xb9fB8ebE83Ff016D2F861Aad3c2Bc1EF5DB2ce08", "4"],
          {
            unsafeAllowCustomTypes: true,
            unsafeAllow: ["delegatecall"],
            initializer: `initializeMintController(address _minterManager, uint256 _initMaxNumOfMinters)`,
          }
        );

        upgraded = await upgrades.upgradeProxy(
          masterMinter.address,
          MasterMinter2,
          {
            unsafeAllow: ["delegatecall"],
          }
        );
      });

      describe("MasterMinter Upgrade Initialization Check", function () {
        it("should upgrade MasterMinter to proper new version", async () => {
          const minterManager = await upgraded.getMinterManager();
          expect(minterManager.toString()).to.equal(
            "0xb9fB8ebE83Ff016D2F861Aad3c2Bc1EF5DB2ce08"
          );
        });

        it("should prevent non-owner from setting controller admin", async () => {
          await expect(
            upgraded.connect(trial).setControllerAdmin(newAdmin.address)
          ).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });

        it("should allow owner to set controller admin", async () => {
          await upgraded.connect(owner).setControllerAdmin(newAdmin.address);
          const controllerAdmin = await upgraded.getControllerAdmin();
          expect(controllerAdmin).to.be.equal(newAdmin.address);
        });
      });
    });

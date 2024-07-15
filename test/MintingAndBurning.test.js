const { assert, expect } = require("chai");
const { ethers, deployments, network, upgrades } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Integration test for minting and burning", function () {
      let tokenv1, masterMinter, owner, permissionAdmin, controllerAdmin, blacklister, pauser, minter1, minter2, rescuer;
      const mintAmount = 5;
      const burnAmount = 4;
      const initialBalance = 20;
      const maxMinters = 4;

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        permissionAdmin = accounts[1];
        controllerAdmin = accounts[2];
        blacklister = accounts[3];
        pauser = accounts[4];
        minter1 = accounts[5];
        rescuer = accounts[6];
        minter2 = accounts[7];

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);

        // set controller admin as non owner address for this test cases
        await masterMinter.setControllerAdmin(controllerAdmin.address);

        await masterMinter.connect(controllerAdmin).configureController(controllerAdmin.address, minter1.address);
        await masterMinter.connect(controllerAdmin).configureMinter(minter1.address, initialBalance);


      });

      describe("Minting and Burning Functionality", function () {
        it("should not allow re-initialization of the same token", async () => {
          await expect(tokenv1.connect(owner).initializeToken(
            "USD Universal",
            "USDU",
            "USD",
            6,
            masterMinter.address,
            pauser.address,
            blacklister.address,
            rescuer.address
          )).to.be.revertedWith(`Initializable: contract is already initialized`);
        });

        it("should not allow minting if the minter is removed", async () => {
          await masterMinter.connect(controllerAdmin).removeMinter(minter1.address);
          await expect(tokenv1.connect(minter1).mint(minter1.address, mintAmount)).to.be.revertedWith(`NotMinter`);
        });

        it("should not allow burning if the minter is removed", async () => {
          await tokenv1.connect(minter1).mint(minter1.address, mintAmount);
          await masterMinter.connect(controllerAdmin).removeMinter(minter1.address);
          await expect(tokenv1.connect(minter1).burn(burnAmount)).to.be.revertedWith(`NotMinter`);
        });

        it("should not allow minting when the token is paused", async () => {
          await tokenv1.connect(pauser).pause();
          await expect(tokenv1.connect(minter1).mint(minter1.address, mintAmount)).to.be.revertedWith(`Pausable__Paused`);
          expect(await tokenv1.totalSupply()).to.equal(0);
        });

        it("should not allow burning when the token is paused", async () => {
          await tokenv1.connect(minter1).mint(minter1.address, mintAmount);
          await tokenv1.connect(pauser).pause();
          await expect(tokenv1.connect(minter1).burn(burnAmount)).to.be.revertedWith(`Pausable__Paused`);
          expect(await tokenv1.totalSupply()).to.equal(mintAmount);
        });

        it("should not allow minting if the minter is blacklisted", async () => {
          await tokenv1.connect(blacklister).blacklist(minter1.address);
          await expect(tokenv1.connect(minter1).mint(minter1.address, mintAmount)).to.be.revertedWith(`Blacklistable__AccountBlacklisted`);
          expect(await tokenv1.totalSupply()).to.equal(0);
        });

        it("should not allow burning if the minter is blacklisted", async () => {
          await tokenv1.connect(minter1).mint(minter1.address, mintAmount);
          await tokenv1.connect(blacklister).blacklist(minter1.address);
          await expect(tokenv1.connect(minter1).burn(burnAmount)).to.be.revertedWith(`Blacklistable__AccountBlacklisted`);
          expect(await tokenv1.totalSupply()).to.equal(mintAmount);
        });

        it("should not allow minting if the mint amount exceeds the allowance", async () => {
          await expect(tokenv1.connect(minter1).mint(minter1.address, initialBalance + 1)).to.be.revertedWith(`AllowanceExceeded`);
          expect(await tokenv1.totalSupply()).to.equal(0);
          expect(await tokenv1.minterAllowance(minter1.address)).to.equal(initialBalance);
        });

        it("should not allow burning if the burn amount exceeds the balance", async () => {
          await tokenv1.connect(minter1).mint(minter1.address, mintAmount);
          await expect(tokenv1.connect(minter1).burn(mintAmount + 1)).to.be.revertedWith(`AmountExceedsBalance`);
          expect(await tokenv1.totalSupply()).to.equal(mintAmount);
          expect(await tokenv1.minterAllowance(minter1.address)).to.equal(initialBalance - mintAmount);
        });

        it("should not allow minting if it is minting a different address", async () => {
          await expect(tokenv1.connect(minter1).mint(minter2.address, mintAmount)).to.be.revertedWith(`NotSelfMinting`);
        });

        it("should mint and burn successfully", async () => {
          await tokenv1.connect(minter1).mint(minter1.address, mintAmount);
          assert.equal(await tokenv1.totalSupply(), mintAmount);
          assert.equal(await tokenv1.balanceOf(minter1.address), mintAmount);

          await tokenv1.connect(minter1).burn(burnAmount);
          const remainingAmount = mintAmount - burnAmount;
          assert.equal(await tokenv1.totalSupply(), remainingAmount);
          assert.equal(await tokenv1.balanceOf(minter1.address), remainingAmount);
        });
      });
    
      describe("Minting and its Impact on Allowances", function () {
          it("should correctly reduce the minter's allowance after a successful mint", async () => {
              await tokenv1.connect(minter1).mint(minter1.address, mintAmount);
              const postMintAllowance = initialBalance - mintAmount;
              expect(await tokenv1.minterAllowance(minter1.address)).to.equal(postMintAllowance);
          });
      
          it("should prevent minting beyond the minter's total allowance", async () => {
              const excessiveAmount = initialBalance + 10; // Amount greater than initial allowance
              await expect(tokenv1.connect(minter1).mint(minter1.address, excessiveAmount))
                  .to.be.revertedWith("AllowanceExceeded");
          });
      });
    
      describe("Edge Cases and Robustness", function () {
          it("should not allow minting to zero address", async () => {
              await expect(tokenv1.connect(minter1).mint(ethers.constants.AddressZero, mintAmount))
                  .to.be.revertedWith("NoZeroAddress");
          });
      
          it("should handle edge case where mint amount is zero", async () => {
              await expect(tokenv1.connect(minter1).mint(minter1.address, 0))
                  .to.be.revertedWith("MintMustBeGreaterThanZero");
          });
      });
    });

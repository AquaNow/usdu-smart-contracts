const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("User Functions", function () {
      let tokenv1, masterMinter, owner, permissionAdmin, controllerAdmin, blacklister, pauser, controller1, minter1, minter2, random1, random2, random3, random4, blacklistedUser;

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        permissionAdmin = accounts[1];
        controllerAdmin = accounts[2];
        blacklister = accounts[3];
        pauser = accounts[4];
        controller1 = accounts[5];
        controller2 = accounts[6];
        minter1 = accounts[7];
        minter2 = accounts[8];
        random1 = accounts[9];
        random2 = accounts[10];
        random3 = accounts[11];
        random4 = accounts[12];
        blacklistedUser = accounts[13];

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);

        await masterMinter.configureController(controller1.address, minter1.address);
        await masterMinter.connect(controller1).configureMinter(minter1.address, 1000);
      });

      describe("Allowance Management", function () {
        it("should approve, decrease, and increase allowance for a random user", async () => {
          await expect(tokenv1.connect(minter1).approve(random3.address, 6))
            .to.emit(tokenv1, "Approval")
            .withArgs(minter1.address, random3.address, 6);

          await expect(tokenv1.connect(minter2).approve(random3.address, 0))
            .to.emit(tokenv1, "Approval")
            .withArgs(minter2.address, random3.address, 0);

          await expect(tokenv1.connect(minter2).approve(minter2.address, 0))
            .to.emit(tokenv1, "Approval")
            .withArgs(minter2.address, minter2.address, 0);

          expect(await tokenv1.connect(minter1).allowance(minter1.address, random3.address)).to.equal(6);

          await tokenv1.connect(minter1).decreaseAllowance(random3.address, 1);
          expect(await tokenv1.connect(minter1).allowance(minter1.address, random3.address)).to.equal(5);

          try {
            const tx = await tokenv1.connect(minter1).decreaseAllowance(random3.address, 10);
            await tx.wait();
            expect.fail("Expected transaction to revert");
          } catch (error) {
            const receipt = await ethers.provider.getTransactionReceipt(error.transactionHash);
            const abiCoder = new ethers.utils.AbiCoder();
            const decoded = abiCoder.decode(
              ['address', 'uint256', 'uint256'],
              ethers.utils.hexDataSlice(error.data, 4)
            );

            expect(decoded[0]).to.equal(random3.address);
            expect(decoded[1].toString()).to.equal('5');
            expect(decoded[2]).to.equal(10);
          }

          expect(await tokenv1.connect(minter1).allowance(minter1.address, random3.address)).to.equal(5);

          await tokenv1.connect(minter1).increaseAllowance(random3.address, 1);
          expect(await tokenv1.connect(minter1).allowance(minter1.address, random3.address)).to.equal(6);
        });
      });

      describe("Token Information", function () {
        it("should return the correct token name", async () => {
          expect(await tokenv1.name()).to.equal("USD Universal");
        });

        it("should return the correct token symbol", async () => {
          expect(await tokenv1.symbol()).to.equal("USDU");
        });

        it("should return the correct token decimals", async () => {
          expect(await tokenv1.decimals()).to.equal(6);
        });
      });

      describe("Token Transfers", function () {
        it("should allow transfer from minter to a random user", async () => {
          await tokenv1.connect(minter1).mint(minter1.address, 1000);
          await tokenv1.connect(minter1).transfer(random4.address, 1);
          expect(await tokenv1.balanceOf(random4.address)).to.equal(1);
        });

        it("should not revert when approving self", async () => {
          await expect(tokenv1.connect(minter1).approve(minter1.address, 2)).to.not.be.revertedWith(`msg.sender not spender`);
        });

        it("should revert when approving a blacklisted address", async () => {
          await tokenv1.connect(blacklister).blacklist(blacklistedUser.address);
          expect(await tokenv1.blacklisted(blacklistedUser.address)).to.equal(true);
          await expect(tokenv1.connect(minter1).approve(blacklistedUser.address, 1)).to.be.revertedWith("Blacklistable__AccountBlacklisted");
        });

        it("should allow transferFrom with correct allowance", async () => {
          await tokenv1.connect(minter1).mint(minter1.address, 4);
            
          await tokenv1.connect(minter1).approve(random3.address, 4);
      
          await tokenv1.connect(random3).transferFrom(minter1.address, random4.address, 4);
      
          const balanceMinter1 = await tokenv1.balanceOf(minter1.address);
          const balanceRandom3 = await tokenv1.balanceOf(random3.address);
          const balanceRandom4 = await tokenv1.balanceOf(random4.address);
      
          assert.equal(balanceMinter1.toString(), '0', "minter1 should have 0 tokens");
          assert.equal(balanceRandom3.toString(), '0', "random3 should have 0 tokens");
          assert.equal(balanceRandom4.toString(), '4', "random4 should have 4 tokens");
      });

        it("should not revert transferFrom with amount = 0 and allowance = 0", async () => {
          await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tokenv1.connect(minter1).transfer(random1.address, 4);
          await expect(tokenv1.connect(random1).transferFrom(minter1.address, random2.address, 0)).to.be.not.revertedWith("allowance = 0");
        });

        it("should revert transferFrom when amount > allowance", async () => {
          await expect(tokenv1.connect(random3).transferFrom(minter1.address, random4.address, 7)).to.be.revertedWith(`AllowanceExceeded`);
        });

        it("should revert transfer to zero address, blacklisted address, and invalid amount", async () => {
          await tokenv1.connect(blacklister).blacklist(blacklistedUser.address);
          expect(await tokenv1.blacklisted(blacklistedUser.address)).to.equal(true);
          
          const zero_address = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");
          await expect(tokenv1.connect(random3).transfer(blacklistedUser.address, 2)).to.be.revertedWith("Blacklistable__AccountBlacklisted");
          await expect(tokenv1.connect(random3).transfer(zero_address, 2)).to.be.revertedWith("NoZeroAddress");
          await expect(tokenv1.connect(random3).transfer(random4.address, 10)).to.be.revertedWith("AmountExceedsBalance");
        });
      });
    });
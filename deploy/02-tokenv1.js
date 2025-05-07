const hre = require("hardhat");
const { ethers, upgrades, deployments, network, artifacts } = hre;
const { waitTx, verify, confirmationsFor } = require("../helpers/deploy-utils");

module.exports = async ({ getNamedAccounts }) => {
    const { save, get, getOrNull } = deployments;
    const { deployer, security } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let shouldVerify = confirmationsFor(chainId) > 1;

    try {
        console.log(`Deploying TokenV1 contract via deployer account ${deployer}`);

        const mmDep = await getOrNull("MasterMinter");
        if (!mmDep) {
            console.error(`❌ MasterMinter deployment not found. Deploy it first, then rerun TokenV1.`);
            throw new Error("MasterMinter deployment missing");
        }
        console.log(`Using MasterMinter proxy at ${mmDep.address}`);

        const Factory = await ethers.getContractFactory("TokenV1");

        const NAME = "USD Universal", SYMBOL = "USDU", CURRENCY = "USD", DECIMALS = 6;
        let proxyAddress, tokenV1Impl, firstDeploy = false;

        const existingDep = await getOrNull("TokenV1");
        if (existingDep) {
            console.log(`Existing TokenV1 proxy @ ${existingDep.address}`);
            try {
                await upgrades.validateUpgrade(existingDep.address, Factory,
                    { unsafeAllow: ["delegatecall", "custom-types"] });
            } catch (err) {
                if (/not registered/i.test(err.message)) {
                    console.warn("Manifest missing – importing proxy into OpenZeppelin manifest…");
                    await upgrades.forceImport(existingDep.address, Factory, { kind: "transparent" });
                    // now retry validation
                    await upgrades.validateUpgrade(existingDep.address, Factory,
                      { unsafeAllow: ["delegatecall", "custom-types"] });
                  } else {
                    console.error("❌ Upgrade validation failed for TokenV1.");
                    throw err;
                }
            }

            const predictedImpl = await upgrades.prepareUpgrade(
                existingDep.address,
                Factory,
                { unsafeAllow: ["delegatecall"], deploy: false }
            );

            const currentImpl = await upgrades.erc1967.getImplementationAddress(existingDep.address);

            if (predictedImpl.toLowerCase() === currentImpl.toLowerCase()) {
                console.log("🔄 Byte-code unchanged — skipping upgrade.");
                proxyAddress = existingDep.address;
                shouldVerify = false;
            } else {
                console.log(`⬆️  Implementation changed (${currentImpl} → ${predictedImpl}) — upgrading…`);
                const upgraded = await upgrades.upgradeProxy(existingDep.address, Factory,
                    { unsafeAllow: ["delegatecall"] });
                await waitTx(upgraded.deployTransaction, network);
                proxyAddress = upgraded.address;
            }
        } else {
            console.log("Deploying new TokenV1 proxy…");
            const proxy = await upgrades.deployProxy(
                Factory,
                [NAME, SYMBOL, CURRENCY, DECIMALS,
                    mmDep.address,
                    security,
                    security,
                    security],
                {
                    initializer: "initializeToken",
                    kind: "transparent",
                    unsafeAllow: ["delegatecall"],
                }
            );
            await waitTx(proxy.deployTransaction, network);
            proxyAddress = proxy.address;
            firstDeploy = true;
        }
        tokenV1Impl = await upgrades.erc1967.getImplementationAddress(proxyAddress);

        if (shouldVerify) {
            await verify(tokenV1Impl, hre, [], "contracts/src/TokenContracts/TokenV1.sol:TokenV1");
        }

        await save("TokenV1", {
            address: proxyAddress,
            abi: (await artifacts.readArtifact("TokenV1")).abi,
        });

        console.log(`🎉 TokenV1 ${firstDeploy ? "deployed" : "upgraded"} @ ${proxyAddress}`);

        console.table({
            tokenV1Proxy: proxyAddress,
            tokenV1Impl,
            firstDeploy,
        });

    } catch (err) {
        console.error(`TokenV1 script failed: ${err.message}`);
        throw err;
    }
};
module.exports.tags = ["token", "masterminter-token", "all"];
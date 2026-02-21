import { network } from "hardhat";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// Connect to whichever network is passed via --network flag (defaults to hardhatMainnet)
const networkName = process.env.HARDHAT_NETWORK ?? "hardhatMainnet";
const isLocalhost = networkName === "localhost";

const { ethers } = await network.connect(
  isLocalhost
    ? { network: "localhost", chainType: "l1" }
    : { network: "hardhatMainnet", chainType: "l1" }
);

const [deployer] = await ethers.getSigners();
console.log("Network  :", networkName);
console.log("Deployer :", deployer.address);
console.log("");

// ─── Deploy AgentBrain ────────────────────────────────────────────────────────

const AgentBrainFactory = await ethers.getContractFactory("AgentBrain");
const agentBrain = await AgentBrainFactory.deploy();
await agentBrain.waitForDeployment();
const agentBrainAddress = await agentBrain.getAddress();
console.log("AgentBrain deployed       →", agentBrainAddress);

// ─── Deploy AgentMarketplace ──────────────────────────────────────────────────

const MarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
const marketplace = await MarketplaceFactory.deploy(agentBrainAddress);
await marketplace.waitForDeployment();
const marketplaceAddress = await marketplace.getAddress();
console.log("AgentMarketplace deployed →", marketplaceAddress);

// ─── Persist addresses for export-contracts.ts ───────────────────────────────

const deployed = {
  chainId: isLocalhost ? 31337 : 31337,
  agentBrain: agentBrainAddress,
  marketplace: marketplaceAddress,
  network: networkName,
  deployedAt: new Date().toISOString(),
};

const outPath = join(process.cwd(), "deployed-local.json");
writeFileSync(outPath, JSON.stringify(deployed, null, 2));
console.log("\nAddresses saved →", outPath);
console.log("\nNext step: npx hardhat run scripts/export-contracts.ts");

import { network } from "hardhat";

// Deploy AgentBrain then AgentMarketplace to the hardhatMainnet simulated network.
// For Sepolia: change network to "sepolia" and chainType to "l1" (same).
const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

const [deployer] = await ethers.getSigners();
console.log("Deploying from:", deployer.address);

// ─── Deploy AgentBrain ────────────────────────────────────────────────────────

const AgentBrainFactory = await ethers.getContractFactory("AgentBrain");
const agentBrain = await AgentBrainFactory.deploy();
await agentBrain.waitForDeployment();
const agentBrainAddress = await agentBrain.getAddress();
console.log("AgentBrain   deployed →", agentBrainAddress);

// ─── Deploy AgentMarketplace ──────────────────────────────────────────────────

const MarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
const marketplace = await MarketplaceFactory.deploy(agentBrainAddress);
await marketplace.waitForDeployment();
const marketplaceAddress = await marketplace.getAddress();
console.log("Marketplace  deployed →", marketplaceAddress);

console.log("\nSummary:");
console.log("  AgentBrain:      ", agentBrainAddress);
console.log("  AgentMarketplace:", marketplaceAddress);

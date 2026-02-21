import { network } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";

const networkName = process.env.HARDHAT_NETWORK ?? "hardhatMainnet";

const CHAIN_IDS: Record<string, number> = {
  localhost: 31337,
  hardhatMainnet: 31337,
  zerog: 16602,
  sepolia: 11155111,
};

const chainId = CHAIN_IDS[networkName] ?? 31337;

// For localhost / zerog we connect to the http endpoint; for in-process nets use edr-simulated
const connectArg =
  networkName === "localhost"
    ? { network: "localhost", chainType: "l1" as const }
    : networkName === "zerog"
    ? { network: "zerog", chainType: "l1" as const }
    : networkName === "sepolia"
    ? { network: "sepolia", chainType: "l1" as const }
    : { network: "hardhatMainnet", chainType: "l1" as const };

const { ethers } = await network.connect(connectArg);

const [deployer] = await ethers.getSigners();
console.log("Network  :", networkName);
console.log("Chain ID :", chainId);
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
  chainId,
  agentBrain: agentBrainAddress,
  marketplace: marketplaceAddress,
  network: networkName,
  deployedAt: new Date().toISOString(),
};

// Save to network-specific file so multiple deployments don't overwrite each other
const outFile = networkName === "zerog" ? "deployed-zerog.json" : "deployed-local.json";
const outPath = join(process.cwd(), outFile);
writeFileSync(outPath, JSON.stringify(deployed, null, 2));

console.log("\nAddresses saved →", outPath);
console.log("\nNext: npx hardhat run scripts/export-contracts.ts --network", networkName);

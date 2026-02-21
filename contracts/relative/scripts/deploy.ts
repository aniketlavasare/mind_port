import "dotenv/config";
import { network } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";

// Hardhat v3 does NOT set HARDHAT_NETWORK from --network; parse argv directly.
const networkFlagIdx = process.argv.indexOf("--network");
const networkName = networkFlagIdx !== -1
  ? process.argv[networkFlagIdx + 1]
  : (process.env.HARDHAT_NETWORK ?? "hardhatMainnet");

const CHAIN_IDS: Record<string, number> = {
  localhost: 31337,
  hardhatMainnet: 31337,
  zerog: 16602,
  sepolia: 11155111,
};

const chainId = CHAIN_IDS[networkName] ?? 31337;

type ChainType = "l1" | "op";
const CONNECT_ARGS: Record<string, { network: string; chainType: ChainType }> = {
  localhost:      { network: "localhost",      chainType: "l1" },
  zerog:          { network: "zerog",          chainType: "l1" },
  sepolia:        { network: "sepolia",        chainType: "l1" },
  hardhatMainnet: { network: "hardhatMainnet", chainType: "l1" },
};

const connectArg = CONNECT_ARGS[networkName] ?? CONNECT_ARGS["hardhatMainnet"];
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

// ─── Persist addresses ────────────────────────────────────────────────────────

const deployed = {
  chainId,
  agentBrain: agentBrainAddress,
  marketplace: marketplaceAddress,
  network: networkName,
  deployedAt: new Date().toISOString(),
};

const outFile = networkName === "zerog" ? "deployed-zerog.json" : "deployed-local.json";
const outPath = join(process.cwd(), outFile);
writeFileSync(outPath, JSON.stringify(deployed, null, 2));

console.log("\nAddresses saved →", outPath);
console.log(`\nNext: npx hardhat run scripts/export-contracts.ts --network ${networkName}`);

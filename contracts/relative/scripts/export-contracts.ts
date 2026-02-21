/**
 * export-contracts.ts
 * Reads deployed-{network}.json and writes apps/web/lib/contracts.{network}.json.
 *
 * Usage:
 *   npx hardhat run scripts/export-contracts.ts --network localhost
 *   npx hardhat run scripts/export-contracts.ts --network zerog
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const networkName = process.env.HARDHAT_NETWORK ?? "localhost";
const isZerog = networkName === "zerog";

const deployedFile = isZerog ? "deployed-zerog.json" : "deployed-local.json";
const outputFile = isZerog ? "contracts.zerog.json" : "contracts.local.json";

const deployedPath = join(process.cwd(), deployedFile);

if (!existsSync(deployedPath)) {
  console.error(`✗  ${deployedFile} not found.`);
  console.error(`   Run: npx hardhat run scripts/deploy.ts --network ${networkName}`);
  process.exit(1);
}

const deployed = JSON.parse(readFileSync(deployedPath, "utf-8")) as {
  chainId: number;
  agentBrain: string;
  marketplace: string;
  network: string;
  deployedAt: string;
};

const webLibPath = join(process.cwd(), "../../apps/web/lib", outputFile);

const output = {
  chainId: deployed.chainId,
  agentBrain: deployed.agentBrain,
  marketplace: deployed.marketplace,
};

writeFileSync(webLibPath, JSON.stringify(output, null, 2));

console.log(`✔  Exported ${outputFile}`);
console.log("   ChainId:          ", deployed.chainId);
console.log("   AgentBrain:       ", deployed.agentBrain);
console.log("   AgentMarketplace: ", deployed.marketplace);
console.log("   Written to:", webLibPath);
console.log("\nRestart the Next.js dev server to pick up new addresses.");

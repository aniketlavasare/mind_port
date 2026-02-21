/**
 * export-contracts.ts
 * Reads deployed-local.json and writes apps/web/lib/contracts.local.json
 * with the deployed addresses. ABIs are maintained statically in lib/contracts.ts.
 *
 * Run after deploy.ts:
 *   npx hardhat run scripts/export-contracts.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const deployedPath = join(process.cwd(), "deployed-local.json");

if (!existsSync(deployedPath)) {
  console.error("✗  deployed-local.json not found.");
  console.error("   Run: npx hardhat run scripts/deploy.ts --network localhost");
  process.exit(1);
}

const deployed = JSON.parse(readFileSync(deployedPath, "utf-8")) as {
  chainId: number;
  agentBrain: string;
  marketplace: string;
  network: string;
  deployedAt: string;
};

// Path: contracts/relative/ → ../../ → mind_port root → apps/web/lib/
const webLibPath = join(process.cwd(), "../../apps/web/lib/contracts.local.json");

const output = {
  chainId: deployed.chainId,
  agentBrain: deployed.agentBrain,
  marketplace: deployed.marketplace,
};

writeFileSync(webLibPath, JSON.stringify(output, null, 2));

console.log("✔  Exported contracts.local.json");
console.log("   ChainId:          ", deployed.chainId);
console.log("   AgentBrain:       ", deployed.agentBrain);
console.log("   AgentMarketplace: ", deployed.marketplace);
console.log("   Written to:", webLibPath);
console.log("\nRestart the Next.js dev server to pick up new addresses.");

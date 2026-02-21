/**
 * interact.ts
 * Full deployment + end-to-end interaction demo for AgentBrain + AgentMarketplace.
 * Run with:  npx hardhat run scripts/interact.ts
 */

import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt  = (wei: bigint) => ethers.formatEther(wei) + " ETH";
const sep  = (title: string) => console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}`);
const step = (msg: string)  => console.log(`\n  ▶  ${msg}`);
const ok   = (msg: string)  => console.log(`  ✔  ${msg}`);
const info = (msg: string)  => console.log(`     ${msg}`);

// ─── Deploy ───────────────────────────────────────────────────────────────────

sep("DEPLOY");

const [owner, seller, bidder1, bidder2] = await ethers.getSigners();
info(`owner   : ${owner.address}`);
info(`seller  : ${seller.address}`);
info(`bidder1 : ${bidder1.address}`);
info(`bidder2 : ${bidder2.address}`);

step("Deploying AgentBrain …");
const BrainFactory = await ethers.getContractFactory("AgentBrain");
const brain = await BrainFactory.deploy();
await brain.waitForDeployment();
const brainAddr = await brain.getAddress();
ok(`AgentBrain deployed → ${brainAddr}`);

step("Deploying AgentMarketplace …");
const MktFactory = await ethers.getContractFactory("AgentMarketplace");
const marketplace = await MktFactory.deploy(brainAddr);
await marketplace.waitForDeployment();
const mktAddr = await marketplace.getAddress();
ok(`AgentMarketplace deployed → ${mktAddr}`);
info(`Marketplace accepts NFTs from: ${await marketplace.nft()}`);

// ─── Scenario 1: Full sale flow ───────────────────────────────────────────────

sep("SCENARIO 1 — Full sale: mint → list → bid → accept");

step("Seller mints token #1 …");
const mintTx = await brain.connect(seller).mint(
  "Pitch Coach",
  "Helps craft compelling startup pitches.",
  "pitch,startup,writing",
  "You are a brutally effective pitch coach. Keep responses tight.",
);
await mintTx.wait();
ok(`Token #1 minted to seller (${seller.address.slice(0, 10)}…)`);

const [creator, name, desc, tags, prompt, createdAt] = await brain.getMeta(1n);
info(`  creator     : ${creator}`);
info(`  name        : ${name}`);
info(`  description : ${desc}`);
info(`  tags        : ${tags}`);
info(`  createdAt   : ${new Date(Number(createdAt) * 1000).toISOString()}`);

step("Seller approves marketplace to transfer token #1 …");
await brain.connect(seller).approve(mktAddr, 1n);
ok("Approval granted");

step("Seller creates listing with minBid = 0.5 ETH …");
const listTx = await marketplace.connect(seller).createListing(1n, ethers.parseEther("0.5"));
await listTx.wait();
const listing1 = await marketplace.listings(1n);
ok(`Listed  |  seller: ${listing1.seller.slice(0, 10)}…  |  minBid: ${fmt(listing1.minBid)}  |  active: ${listing1.active}`);
info(`NFT owner is now marketplace: ${await brain.ownerOf(1n) === mktAddr}`);

step("Bidder1 places bid of 0.6 ETH …");
const bid1Tx = await marketplace.connect(bidder1).placeBid(1n, { value: ethers.parseEther("0.6") });
await bid1Tx.wait();
const hb1 = await marketplace.highestBids(1n);
ok(`Highest bid  |  bidder: ${hb1.bidder.slice(0, 10)}…  |  amount: ${fmt(hb1.amount)}`);
info(`Marketplace escrow balance: ${fmt(await ethers.provider.getBalance(mktAddr))}`);

const sellerBalBefore = await ethers.provider.getBalance(seller.address);
step("Seller accepts highest bid …");
await (await marketplace.connect(seller).acceptHighestBid(1n)).wait();

const sellerBalAfter = await ethers.provider.getBalance(seller.address);
const mktBalAfter = await ethers.provider.getBalance(mktAddr);
ok(`Sale finalised!`);
info(`NFT owner is now bidder1: ${await brain.ownerOf(1n) === bidder1.address}`);
info(`Marketplace escrow balance: ${fmt(mktBalAfter)} (should be 0)`);
info(`Seller received ~${fmt(sellerBalAfter - sellerBalBefore)} net (bid minus gas)`);
const postListing1 = await marketplace.listings(1n);
info(`Listing cleared  |  active: ${postListing1.active}`);

// ─── Scenario 2: Outbid with refund ───────────────────────────────────────────

sep("SCENARIO 2 — Outbid: bidder1 refunded when bidder2 places higher bid");

step("Seller mints token #2 …");
await (await brain.connect(seller).mint(
  "Code Reviewer",
  "Reviews code for bugs and improvements.",
  "code,review,engineering",
  "You are a senior software engineer. Be direct.",
)).wait();
ok("Token #2 minted");

await brain.connect(seller).approve(mktAddr, 2n);
await marketplace.connect(seller).createListing(2n, ethers.parseEther("0.1"));
ok("Token #2 listed with minBid = 0.1 ETH");

step("Bidder1 bids 0.2 ETH …");
await (await marketplace.connect(bidder1).placeBid(2n, { value: ethers.parseEther("0.2") })).wait();
const b1Before = await ethers.provider.getBalance(bidder1.address);
info(`Bidder1 balance after bid: ${fmt(b1Before)}`);
info(`Marketplace holds: ${fmt(await ethers.provider.getBalance(mktAddr))}`);

step("Bidder2 outbids with 0.5 ETH — bidder1 is refunded …");
await (await marketplace.connect(bidder2).placeBid(2n, { value: ethers.parseEther("0.5") })).wait();
const b1After = await ethers.provider.getBalance(bidder1.address);
const hb2 = await marketplace.highestBids(2n);

ok(`Bidder1 refunded: balance went ${fmt(b1Before)} → ${fmt(b1After)} (+ ${fmt(b1After - b1Before)})`);
ok(`New highest bid  |  bidder2  |  amount: ${fmt(hb2.amount)}`);
info(`Marketplace holds: ${fmt(await ethers.provider.getBalance(mktAddr))} (bidder2's 0.5 ETH only)`);

step("Seller accepts bidder2's bid …");
await (await marketplace.connect(seller).acceptHighestBid(2n)).wait();
ok(`NFT #2 owner is now bidder2: ${await brain.ownerOf(2n) === bidder2.address}`);
info(`Marketplace escrow balance: ${fmt(await ethers.provider.getBalance(mktAddr))}`);

// ─── Scenario 3: Cancel listing (no bids) ─────────────────────────────────────

sep("SCENARIO 3 — Cancel listing (no bids placed)");

step("Seller mints token #3 and lists it …");
await (await brain.connect(seller).mint("Research Bot", "Summarises topics.", "research", "Be thorough.")).wait();
await brain.connect(seller).approve(mktAddr, 3n);
await marketplace.connect(seller).createListing(3n, ethers.parseEther("1.0"));
ok("Token #3 listed  |  no bids placed");
info(`NFT is in escrow: ${await brain.ownerOf(3n) === mktAddr}`);

step("Seller cancels listing …");
await (await marketplace.connect(seller).cancelListing(3n)).wait();
ok("Listing cancelled");
const postListing3 = await marketplace.listings(3n);
info(`Listing active: ${postListing3.active}`);
info(`NFT returned to seller: ${await brain.ownerOf(3n) === seller.address}`);

// ─── Scenario 4: Cancel blocked when bids exist ───────────────────────────────

sep("SCENARIO 4 — Cancel blocked when bids exist");

step("Seller mints token #4, lists it, bidder1 places a bid …");
await (await brain.connect(seller).mint("Math Tutor", "Teaches maths step by step.", "math,tutor", "Explain step by step.")).wait();
await brain.connect(seller).approve(mktAddr, 4n);
await marketplace.connect(seller).createListing(4n, 0n);
await marketplace.connect(bidder1).placeBid(4n, { value: ethers.parseEther("0.3") });
ok("Token #4 listed and bid placed");

step("Seller tries to cancel (should revert) …");
try {
  await marketplace.connect(seller).cancelListing(4n);
  console.log("  ✗  ERROR: should have reverted!");
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  ok(`Correctly reverted: "${msg.split("'")[1] ?? msg.split('"')[1] ?? "bids exist"}"`);
}

// ─── Scenario 5: Access control ───────────────────────────────────────────────

sep("SCENARIO 5 — Access control checks");

step("Non-owner tries to list token #4 (in escrow, owned by marketplace) …");
try {
  await marketplace.connect(bidder2).createListing(4n, 0n);
  console.log("  ✗  ERROR: should have reverted!");
} catch {
  ok("Reverted: only token owner can list");
}

step("Non-seller tries to accept bid on token #4 …");
try {
  await marketplace.connect(bidder2).acceptHighestBid(4n);
  console.log("  ✗  ERROR: should have reverted!");
} catch {
  ok("Reverted: only seller can accept");
}

step("Bidder tries to bid on inactive listing (token #3, already cancelled) …");
try {
  await marketplace.connect(bidder1).placeBid(3n, { value: ethers.parseEther("0.1") });
  console.log("  ✗  ERROR: should have reverted!");
} catch {
  ok("Reverted: listing not active");
}

step("Seller tries to accept on token #3 which has no bids …");
try {
  // Actually token #3 listing is cancelled/inactive, so this should revert with "not active"
  await marketplace.connect(seller).acceptHighestBid(3n);
  console.log("  ✗  ERROR: should have reverted!");
} catch {
  ok("Reverted: listing not active");
}

// ─── Scenario 6: updateMeta ───────────────────────────────────────────────────

sep("SCENARIO 6 — updateMeta (owner can edit, non-owner cannot)");

step("Bidder1 now owns token #1. They update its metadata …");
await brain.connect(bidder1).updateMeta(1n, "Pitch Coach v2", "Updated description", "pitch,v2", "New system prompt.");
const [, newName, newDesc] = await brain.getMeta(1n);
ok(`Updated  |  name: "${newName}"  |  description: "${newDesc}"`);

step("Seller (no longer owner) tries to update token #1 …");
try {
  await brain.connect(seller).updateMeta(1n, "Hack", "", "", "");
  console.log("  ✗  ERROR: should have reverted!");
} catch {
  ok("Reverted: not token owner");
}

// ─── Final state summary ──────────────────────────────────────────────────────

sep("FINAL STATE SUMMARY");

const totalMinted = await brain.totalMinted();
info(`Total tokens minted: ${totalMinted}`);

for (let id = 1n; id <= totalMinted; id++) {
  try {
    const currentOwner = await brain.ownerOf(id);
    const [, n] = await brain.getMeta(id);
    const ownerLabel =
      currentOwner === seller.address  ? "seller"  :
      currentOwner === bidder1.address ? "bidder1" :
      currentOwner === bidder2.address ? "bidder2" :
      currentOwner === mktAddr         ? "marketplace (escrow)" :
      currentOwner;
    info(`  token #${id}  "${n}"  →  ${ownerLabel}`);
  } catch {
    info(`  token #${id}  (burned or non-existent)`);
  }
}

info(`\nFinal marketplace escrow balance: ${fmt(await ethers.provider.getBalance(mktAddr))}`);

console.log(`\n${"═".repeat(60)}`);
console.log("  All scenarios completed.");
console.log(`${"═".repeat(60)}\n`);

import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deploy fresh AgentBrain + AgentMarketplace and return common references. */
async function deploy() {
  const [deployer, seller, bidder1, bidder2] = await ethers.getSigners();

  const AgentBrainFactory = await ethers.getContractFactory("AgentBrain");
  const brain = await AgentBrainFactory.deploy();
  await brain.waitForDeployment();

  const MarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
  const marketplace = await MarketplaceFactory.deploy(await brain.getAddress());
  await marketplace.waitForDeployment();

  return { brain, marketplace, deployer, seller, bidder1, bidder2 };
}

/**
 * Mint a token as `signer`, approve marketplace, and create a listing.
 * Returns the tokenId (BigInt) extracted from the Minted event.
 */
async function mintApproveList(
  brain: Awaited<ReturnType<typeof deploy>>["brain"],
  marketplace: Awaited<ReturnType<typeof deploy>>["marketplace"],
  signer: Awaited<ReturnType<typeof deploy>>["seller"],
  minBid: bigint,
): Promise<bigint> {
  const tx = await brain.connect(signer).mint(
    "Test Agent",
    "A test agent",
    "test,demo",
    "You are a helpful assistant.",
  );
  const receipt = await tx.wait();

  // Parse the Minted event to get the tokenId
  let tokenId: bigint | undefined;
  for (const log of receipt!.logs) {
    try {
      const parsed = brain.interface.parseLog(log);
      if (parsed?.name === "Minted") {
        tokenId = parsed.args[0] as bigint;
        break;
      }
    } catch {
      // skip logs that don't belong to this contract
    }
  }
  if (tokenId === undefined) throw new Error("Minted event not found");

  const marketplaceAddress = await marketplace.getAddress();
  await brain.connect(signer).approve(marketplaceAddress, tokenId);
  await marketplace.connect(signer).createListing(tokenId, minBid);

  return tokenId;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("AgentBrain", function () {
  it("mints to msg.sender with correct metadata", async function () {
    const { brain, seller } = await deploy();

    const tx = await brain.connect(seller).mint(
      "Pitch Coach",
      "Helps craft pitches",
      "pitch,startup",
      "You are a pitch coach.",
    );
    await tx.wait();

    expect(await brain.ownerOf(1n)).to.equal(seller.address);
    expect(await brain.totalMinted()).to.equal(1n);

    const [creator, name, desc, tags, prompt, createdAt] = await brain.getMeta(1n);
    expect(creator).to.equal(seller.address);
    expect(name).to.equal("Pitch Coach");
    expect(desc).to.equal("Helps craft pitches");
    expect(tags).to.equal("pitch,startup");
    expect(prompt).to.equal("You are a pitch coach.");
    expect(createdAt).to.be.gt(0n);
  });

  it("token IDs increment from 1", async function () {
    const { brain, seller, bidder1 } = await deploy();

    await (await brain.connect(seller).mint("A1", "", "", "p1")).wait();
    await (await brain.connect(bidder1).mint("A2", "", "", "p2")).wait();

    expect(await brain.ownerOf(1n)).to.equal(seller.address);
    expect(await brain.ownerOf(2n)).to.equal(bidder1.address);
    expect(await brain.totalMinted()).to.equal(2n);
  });

  it("owner can update metadata; non-owner cannot", async function () {
    const { brain, seller, bidder1 } = await deploy();
    await (await brain.connect(seller).mint("Old Name", "old", "old", "old prompt")).wait();

    await brain.connect(seller).updateMeta(1n, "New Name", "new desc", "new,tags", "new prompt");
    const [, name, desc, tags, prompt] = await brain.getMeta(1n);
    expect(name).to.equal("New Name");
    expect(desc).to.equal("new desc");

    // Non-owner update should revert
    await expect(
      brain.connect(bidder1).updateMeta(1n, "Hack", "", "", ""),
    ).to.be.revertedWith("AgentBrain: not token owner");
  });
});

describe("AgentMarketplace – A: full happy path", function () {
  it("mint → approve → list → bid → acceptHighestBid transfers NFT and pays seller", async function () {
    const { brain, marketplace, seller, bidder1 } = await deploy();

    const BID = ethers.parseEther("0.5");
    const tokenId = await mintApproveList(brain, marketplace, seller, BID);

    // NFT should be in escrow after listing
    expect(await brain.ownerOf(tokenId)).to.equal(await marketplace.getAddress());

    // Snapshot seller balance before accepting (we will check it improved)
    const sellerBefore = await ethers.provider.getBalance(seller.address);

    // Place bid
    await marketplace.connect(bidder1).placeBid(tokenId, { value: BID });

    // Seller accepts
    await marketplace.connect(seller).acceptHighestBid(tokenId);

    // NFT must be with bidder1
    expect(await brain.ownerOf(tokenId)).to.equal(bidder1.address);

    // Marketplace must hold no ETH
    const mpBalance = await ethers.provider.getBalance(await marketplace.getAddress());
    expect(mpBalance).to.equal(0n);

    // Seller must have received ETH (net gain > 0 despite gas, because BID >> gas cost)
    const sellerAfter = await ethers.provider.getBalance(seller.address);
    expect(sellerAfter).to.be.gt(sellerBefore);

    // Listing must be cleared
    const listing = await marketplace.listings(tokenId);
    expect(listing.active).to.be.false;
  });
});

describe("AgentMarketplace – B: outbid refund", function () {
  it("bidder1 is refunded when bidder2 places a higher bid", async function () {
    const { brain, marketplace, seller, bidder1, bidder2 } = await deploy();

    const MIN_BID = ethers.parseEther("0.1");
    const BID1    = ethers.parseEther("0.2");
    const BID2    = ethers.parseEther("0.5");

    const tokenId = await mintApproveList(brain, marketplace, seller, MIN_BID);

    // bidder1 places first bid
    await marketplace.connect(bidder1).placeBid(tokenId, { value: BID1 });

    const bidder1AfterFirstBid = await ethers.provider.getBalance(bidder1.address);

    // bidder2 outbids — should trigger refund of bidder1
    await marketplace.connect(bidder2).placeBid(tokenId, { value: BID2 });

    const bidder1AfterRefund = await ethers.provider.getBalance(bidder1.address);

    // bidder1 got refunded, so balance increased from post-bid state
    expect(bidder1AfterRefund).to.be.gt(bidder1AfterFirstBid);

    // Marketplace should hold only BID2
    const mpBalance = await ethers.provider.getBalance(await marketplace.getAddress());
    expect(mpBalance).to.equal(BID2);

    // Highest bid should reflect bidder2
    const highestBid = await marketplace.highestBids(tokenId);
    expect(highestBid.bidder).to.equal(bidder2.address);
    expect(highestBid.amount).to.equal(BID2);
  });

  it("rejects a bid that does not exceed the current highest", async function () {
    const { brain, marketplace, seller, bidder1, bidder2 } = await deploy();

    const MIN_BID = ethers.parseEther("0.1");
    const tokenId = await mintApproveList(brain, marketplace, seller, MIN_BID);

    await marketplace.connect(bidder1).placeBid(tokenId, { value: ethers.parseEther("0.3") });

    // Same amount → should revert
    await expect(
      marketplace.connect(bidder2).placeBid(tokenId, { value: ethers.parseEther("0.3") }),
    ).to.be.revertedWith("Marketplace: bid not higher than current");

    // Lower amount → should revert
    await expect(
      marketplace.connect(bidder2).placeBid(tokenId, { value: ethers.parseEther("0.1") }),
    ).to.be.revertedWith("Marketplace: bid not higher than current");
  });
});

describe("AgentMarketplace – C: cancel listing (no bids)", function () {
  it("returns NFT to seller and clears listing when no bids placed", async function () {
    const { brain, marketplace, seller } = await deploy();

    const tokenId = await mintApproveList(brain, marketplace, seller, ethers.parseEther("0.1"));

    // NFT is in escrow
    expect(await brain.ownerOf(tokenId)).to.equal(await marketplace.getAddress());

    await marketplace.connect(seller).cancelListing(tokenId);

    // NFT should be back with seller
    expect(await brain.ownerOf(tokenId)).to.equal(seller.address);

    // Listing should be gone
    const listing = await marketplace.listings(tokenId);
    expect(listing.active).to.be.false;
  });
});

describe("AgentMarketplace – D: cancel listing (bids exist) fails", function () {
  it("reverts cancelListing if a bid has been placed", async function () {
    const { brain, marketplace, seller, bidder1 } = await deploy();

    const tokenId = await mintApproveList(brain, marketplace, seller, ethers.parseEther("0.1"));

    await marketplace.connect(bidder1).placeBid(tokenId, { value: ethers.parseEther("0.2") });

    await expect(
      marketplace.connect(seller).cancelListing(tokenId),
    ).to.be.revertedWith("Marketplace: bids exist, accept the highest bid to resolve");

    // NFT must still be in escrow
    expect(await brain.ownerOf(tokenId)).to.equal(await marketplace.getAddress());
  });
});

describe("AgentMarketplace – E: access control", function () {
  it("only current token owner can create a listing", async function () {
    const { brain, marketplace, seller, bidder1 } = await deploy();

    // seller mints tokenId=1
    await (await brain.connect(seller).mint("A", "", "", "p")).wait();

    const marketplaceAddress = await marketplace.getAddress();
    await brain.connect(seller).approve(marketplaceAddress, 1n);

    // bidder1 tries to list seller's token → revert
    await expect(
      marketplace.connect(bidder1).createListing(1n, 0n),
    ).to.be.revertedWith("Marketplace: not token owner");
  });

  it("only seller can call acceptHighestBid", async function () {
    const { brain, marketplace, seller, bidder1, bidder2 } = await deploy();

    const tokenId = await mintApproveList(brain, marketplace, seller, 0n);
    await marketplace.connect(bidder1).placeBid(tokenId, { value: ethers.parseEther("0.1") });

    // bidder2 (not seller) tries to accept → revert
    await expect(
      marketplace.connect(bidder2).acceptHighestBid(tokenId),
    ).to.be.revertedWith("Marketplace: not seller");
  });

  it("only seller can call cancelListing", async function () {
    const { brain, marketplace, seller, bidder1 } = await deploy();

    const tokenId = await mintApproveList(brain, marketplace, seller, 0n);

    // bidder1 tries to cancel seller's listing → revert
    await expect(
      marketplace.connect(bidder1).cancelListing(tokenId),
    ).to.be.revertedWith("Marketplace: not seller");
  });

  it("acceptHighestBid reverts when no bids exist", async function () {
    const { brain, marketplace, seller } = await deploy();

    const tokenId = await mintApproveList(brain, marketplace, seller, 0n);

    await expect(
      marketplace.connect(seller).acceptHighestBid(tokenId),
    ).to.be.revertedWith("Marketplace: no bids placed");
  });

  it("placeBid reverts on inactive listing", async function () {
    const { brain, marketplace, bidder1 } = await deploy();

    // tokenId 999 was never listed
    await expect(
      marketplace.connect(bidder1).placeBid(999n, { value: ethers.parseEther("0.1") }),
    ).to.be.revertedWith("Marketplace: listing not active");
  });

  it("cannot list the same token twice", async function () {
    const { brain, marketplace, seller } = await deploy();

    // First listing succeeds
    await mintApproveList(brain, marketplace, seller, 0n);

    // The token is now in escrow (owned by marketplace), so re-listing should fail
    // (marketplace is now the owner, not seller)
    await expect(
      marketplace.connect(seller).createListing(1n, 0n),
    ).to.be.revertedWith("Marketplace: not token owner");
  });

  it("bid must meet minBid", async function () {
    const { brain, marketplace, seller, bidder1 } = await deploy();

    const tokenId = await mintApproveList(
      brain,
      marketplace,
      seller,
      ethers.parseEther("1.0"),
    );

    await expect(
      marketplace.connect(bidder1).placeBid(tokenId, { value: ethers.parseEther("0.5") }),
    ).to.be.revertedWith("Marketplace: below minimum bid");
  });
});

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  AgentMarketplace
 * @notice Escrow-based NFT marketplace for a single AgentBrain collection.
 *
 *         Flow:
 *           1. Owner approves marketplace and calls createListing() → NFT held in escrow.
 *           2. Bidders call placeBid() with ETH. Each new bid must exceed the current
 *              highest; the displaced bidder is immediately refunded.
 *           3. Seller calls acceptHighestBid() → NFT transferred to winning bidder,
 *              ETH transferred to seller.
 *
 *         Cancellation rule:
 *           cancelListing() is only allowed when NO bids have been placed.
 *           This eliminates refund-batch complexity while keeping the contract safe.
 *           If bids exist, the seller must acceptHighestBid() to resolve the listing.
 *
 * @dev    Uses Checks-Effects-Interactions throughout.
 *         ETH refunds use low-level call to avoid reverting on EOA gas stipend issues.
 */
contract AgentMarketplace is ReentrancyGuard, IERC721Receiver {

    // ─── Types ────────────────────────────────────────────────────────────────

    struct Listing {
        address  seller;
        uint256  minBid;
        bool     active;
    }

    struct HighestBid {
        address  bidder;
        uint256  amount;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// The NFT collection this marketplace serves.
    IERC721 public immutable nft;

    mapping(uint256 => Listing)    public listings;
    mapping(uint256 => HighestBid) public highestBids;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Listed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 minBid
    );

    event BidPlaced(
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount
    );

    event BidRefunded(
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount
    );

    event SaleFinalized(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 amount
    );

    event ListingCancelled(
        uint256 indexed tokenId,
        address indexed seller
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address nft_) {
        require(nft_ != address(0), "Marketplace: zero address");
        nft = IERC721(nft_);
    }

    // ─── Seller: create listing ───────────────────────────────────────────────

    /**
     * @notice List an AgentBrain NFT for sale via open bidding.
     *         The caller must own the token and have approved this contract.
     *         The NFT is transferred into escrow immediately.
     * @param  tokenId Token to list.
     * @param  minBid  Minimum acceptable bid in wei. Can be 0 (accept any bid).
     */
    function createListing(uint256 tokenId, uint256 minBid) external {
        require(nft.ownerOf(tokenId) == msg.sender, "Marketplace: not token owner");
        require(!listings[tokenId].active, "Marketplace: already listed");

        // Checks-Effects-Interactions: update state before external call
        listings[tokenId] = Listing({
            seller: msg.sender,
            minBid: minBid,
            active: true
        });

        emit Listed(tokenId, msg.sender, minBid);

        // Transfer NFT into escrow — requires prior approval from owner
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
    }

    // ─── Bidder: place bid ────────────────────────────────────────────────────

    /**
     * @notice Place an ETH bid on an active listing.
     *         msg.value must be >= minBid AND > current highest bid.
     *         The previously highest bidder is refunded immediately.
     * @param  tokenId Token to bid on.
     */
    function placeBid(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Marketplace: listing not active");
        require(msg.value >= listing.minBid, "Marketplace: below minimum bid");

        HighestBid storage current = highestBids[tokenId];
        require(msg.value > current.amount, "Marketplace: bid not higher than current");

        // --- Effects ---
        address prevBidder = current.bidder;
        uint256 prevAmount = current.amount;

        current.bidder = msg.sender;
        current.amount = msg.value;

        emit BidPlaced(tokenId, msg.sender, msg.value);

        // --- Interactions: refund displaced bidder ---
        if (prevBidder != address(0)) {
            (bool ok, ) = payable(prevBidder).call{value: prevAmount}("");
            require(ok, "Marketplace: refund failed");
            emit BidRefunded(tokenId, prevBidder, prevAmount);
        }
    }

    // ─── Seller: accept highest bid ───────────────────────────────────────────

    /**
     * @notice Accept the current highest bid, finalising the sale.
     *         Only the seller may call this. A bid must exist.
     *         NFT is transferred to the winning bidder; ETH is sent to the seller.
     * @param  tokenId Token whose listing to finalise.
     */
    function acceptHighestBid(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Marketplace: listing not active");
        require(listing.seller == msg.sender, "Marketplace: not seller");

        HighestBid storage bid = highestBids[tokenId];
        require(bid.bidder != address(0), "Marketplace: no bids placed");

        // --- Effects ---
        address seller = listing.seller;
        address buyer  = bid.bidder;
        uint256 amount = bid.amount;

        delete listings[tokenId];
        delete highestBids[tokenId];

        emit SaleFinalized(tokenId, seller, buyer, amount);

        // --- Interactions ---
        nft.safeTransferFrom(address(this), buyer, tokenId);

        (bool ok, ) = payable(seller).call{value: amount}("");
        require(ok, "Marketplace: payment to seller failed");
    }

    // ─── Seller: cancel listing ───────────────────────────────────────────────

    /**
     * @notice Cancel an active listing and return the NFT to the seller.
     *         Only allowed when NO bids have been placed yet.
     *         If bids exist, the seller must call acceptHighestBid() instead.
     * @param  tokenId Token whose listing to cancel.
     */
    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Marketplace: listing not active");
        require(listing.seller == msg.sender, "Marketplace: not seller");
        require(
            highestBids[tokenId].bidder == address(0),
            "Marketplace: bids exist, accept the highest bid to resolve"
        );

        // --- Effects ---
        address seller = listing.seller;
        delete listings[tokenId];

        emit ListingCancelled(tokenId, seller);

        // --- Interactions ---
        nft.safeTransferFrom(address(this), seller, tokenId);
    }

    // ─── IERC721Receiver ──────────────────────────────────────────────────────

    /**
     * @dev Required so this contract can receive ERC-721 tokens via safeTransferFrom.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title  AgentBrain
 * @notice ERC-721 NFT where each token represents a saved AI agent specification.
 *         Anyone can mint. Metadata is stored fully on-chain in a per-token struct.
 *         The token owner can update their own metadata at any time.
 */
contract AgentBrain is ERC721 {

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct BrainMeta {
        address  creator;      // original minter, never changes
        string   name;
        string   description;
        string   tags;         // comma-separated, e.g. "coding,review,python"
        string   prompt;       // system prompt stored as-is
        uint64   createdAt;    // block.timestamp at mint
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// Token IDs start at 1.
    uint256 private _nextTokenId = 1;

    mapping(uint256 => BrainMeta) private _meta;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Minted(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed creator,
        string  name
    );

    event MetaUpdated(
        uint256 indexed tokenId,
        string  name
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() ERC721("AgentBrain", "BRAIN") {}

    // ─── Public: Mint ─────────────────────────────────────────────────────────

    /**
     * @notice Mint a new AgentBrain token to the caller.
     * @param  name_        Human-readable agent name.
     * @param  description_ Short description of the agent.
     * @param  tags_        Comma-separated tag list.
     * @param  prompt_      System prompt / instruction for the agent.
     * @return tokenId      The newly minted token ID.
     */
    function mint(
        string calldata name_,
        string calldata description_,
        string calldata tags_,
        string calldata prompt_
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        _safeMint(msg.sender, tokenId);

        _meta[tokenId] = BrainMeta({
            creator:     msg.sender,
            name:        name_,
            description: description_,
            tags:        tags_,
            prompt:      prompt_,
            createdAt:   uint64(block.timestamp)
        });

        emit Minted(tokenId, msg.sender, msg.sender, name_);
        return tokenId;
    }

    // ─── Public: Update metadata ──────────────────────────────────────────────

    /**
     * @notice Update mutable metadata fields of a token.
     *         Only the current token owner may call this.
     *         `creator` and `createdAt` are immutable and cannot be changed.
     * @param  tokenId      The token whose metadata to update.
     * @param  name_        New name.
     * @param  description_ New description.
     * @param  tags_        New tag list.
     * @param  prompt_      New system prompt.
     */
    function updateMeta(
        uint256 tokenId,
        string calldata name_,
        string calldata description_,
        string calldata tags_,
        string calldata prompt_
    ) external {
        require(ownerOf(tokenId) == msg.sender, "AgentBrain: not token owner");

        BrainMeta storage m = _meta[tokenId];
        m.name        = name_;
        m.description = description_;
        m.tags        = tags_;
        m.prompt      = prompt_;

        emit MetaUpdated(tokenId, name_);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    /**
     * @notice Retrieve all metadata for a given token.
     * @param  tokenId Token to query (must exist).
     * @return creator     Original minter address.
     * @return name_       Agent name.
     * @return description_ Agent description.
     * @return tags_       Comma-separated tags.
     * @return prompt_     System prompt.
     * @return createdAt   Unix timestamp of mint.
     */
    function getMeta(uint256 tokenId)
        external
        view
        returns (
            address creator,
            string memory name_,
            string memory description_,
            string memory tags_,
            string memory prompt_,
            uint64 createdAt
        )
    {
        // ownerOf reverts for non-existent tokens (ERC721 standard)
        ownerOf(tokenId);
        BrainMeta storage m = _meta[tokenId];
        return (m.creator, m.name, m.description, m.tags, m.prompt, m.createdAt);
    }

    /**
     * @notice Total number of tokens ever minted (not accounting for burns).
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}

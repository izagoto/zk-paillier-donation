// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Montgomery4096.sol";

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[1] calldata pubSignals
    ) external view returns (bool);
}

contract DonationLedger {
    struct Campaign {
        string title;
        uint256 targetAmount;
        uint256 donationCount;
        bool active;
        bool exists;
    }

    struct Donation {
        uint256 campaignId;
        uint256 commitment;
        bytes ciphertext;
        address sender;
        uint256 blockTime;
    }

    IGroth16Verifier public immutable verifier;
    address public immutable manager;
    uint256 public immutable n0inv;
    uint256[16] private nSquared;
    uint256[16] private rSquared;
    uint256[16] private encZero;

    uint256 public nextCampaignId = 1;
    uint256 public nextDonationId = 1;
    mapping(uint256 => bool) public registered;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Donation) public donations;
    mapping(uint256 => uint256[16]) private aggregates;

    error EmptyCommitment();
    error AlreadyRegistered();
    error NotManager();
    error UnknownCampaign();
    error CampaignClosed();
    error NotRegistered();
    error EmptyCiphertext();
    error InvalidProof();

    event CampaignCreated(uint256 indexed campaignId, string title, uint256 targetAmount);
    event IdentityRegistered(uint256 indexed commitment);
    event DonationRecorded(
        uint256 indexed campaignId,
        uint256 indexed donationId,
        uint256 commitment,
        address sender,
        bytes ciphertext
    );

    constructor(
        address verifier_,
        address manager_,
        uint256 n0inv_,
        uint256[16] memory nSquared_,
        uint256[16] memory rSquared_,
        uint256[16] memory encZero_
    ) {
        verifier = IGroth16Verifier(verifier_);
        manager = manager_;
        n0inv = n0inv_;
        nSquared = nSquared_;
        rSquared = rSquared_;
        encZero = encZero_;
    }

    function aggregateOf(uint256 campaignId) external view returns (uint256[16] memory) {
        return aggregates[campaignId];
    }

    function register(uint256 commitment) external {
        if (commitment == 0) revert EmptyCommitment();
        if (registered[commitment]) revert AlreadyRegistered();
        registered[commitment] = true;
        emit IdentityRegistered(commitment);
    }

    function createCampaign(string calldata title, uint256 targetAmount) external returns (uint256 campaignId) {
        if (msg.sender != manager) revert NotManager();
        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            title: title,
            targetAmount: targetAmount,
            donationCount: 0,
            active: true,
            exists: true
        });
        aggregates[campaignId] = encZero;
        emit CampaignCreated(campaignId, title, targetAmount);
    }

    function donate(
        uint256 campaignId,
        uint256 commitment,
        uint256[16] calldata ciphertext,
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC
    ) external returns (uint256 donationId) {
        Campaign storage campaign = campaigns[campaignId];
        if (!campaign.exists) revert UnknownCampaign();
        if (!campaign.active) revert CampaignClosed();
        if (!registered[commitment]) revert NotRegistered();
        if (limbsAreZero(ciphertext)) revert EmptyCiphertext();

        uint256[1] memory pubSignals = [commitment];
        if (!verifier.verifyProof(pA, pB, pC, pubSignals)) revert InvalidProof();

        aggregates[campaignId] = Montgomery4096.mulMod(
            aggregates[campaignId],
            copyLimbs(ciphertext),
            nSquared,
            n0inv,
            rSquared
        );

        donationId = nextDonationId++;
        bytes memory encoded = limbsToBytes(ciphertext);
        donations[donationId] = Donation({
            campaignId: campaignId,
            commitment: commitment,
            ciphertext: encoded,
            sender: msg.sender,
            blockTime: block.timestamp
        });
        campaign.donationCount += 1;
        emit DonationRecorded(campaignId, donationId, commitment, msg.sender, encoded);
    }

    function copyLimbs(uint256[16] calldata input) private pure returns (uint256[16] memory output) {
        for (uint256 i = 0; i < 16; i++) {
            output[i] = input[i];
        }
    }

    function limbsAreZero(uint256[16] calldata input) private pure returns (bool) {
        for (uint256 i = 0; i < 16; i++) {
            if (input[i] != 0) return false;
        }
        return true;
    }

    function limbsToBytes(uint256[16] calldata input) private pure returns (bytes memory out) {
        out = new bytes(512);
        for (uint256 i = 0; i < 16; i++) {
            uint256 limb = input[15 - i];
            for (uint256 b = 0; b < 32; b++) {
                out[i * 32 + b] = bytes1(uint8(limb >> (8 * (31 - b))));
            }
        }
    }
}

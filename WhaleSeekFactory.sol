// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { WhaleSeekWallet } from "./WhaleSeekWallet.sol";

contract WhaleSeekFactory is Ownable {
    struct WalletInfo {
        address walletAddress;
        address owner;
        address agent;
        uint256 deployedAt;
    }

    address[] private s_deployedWallets;
    
    mapping(address => WalletInfo) private s_walletInfo;
    
    mapping(address => address[]) private s_ownerWallets;

    event WalletDeployed(
        address indexed walletAddress,
        address indexed owner,
        address indexed agent,
        uint256 deployedAt
    );

    error WhaleSeekFactory__ZeroAddress();
    error WhaleSeekFactory__DeploymentFailed();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Deploys a new WhaleSeekWallet
     * @param owner Address that will own the new wallet
     * @param agent Address that will be authorized to execute swaps
     * @return wallet Address of the newly deployed wallet
     */
    function deployWallet(address owner, address agent) external onlyOwner returns (address wallet) {
        if (owner == address(0) || agent == address(0)) {
            revert WhaleSeekFactory__ZeroAddress();
        }

        wallet = address(new WhaleSeekWallet(owner, agent));
        
        if (wallet == address(0)) {
            revert WhaleSeekFactory__DeploymentFailed();
        }

        WalletInfo memory newWallet = WalletInfo({
            walletAddress: wallet,
            owner: owner,
            agent: agent,
            deployedAt: block.timestamp
        });

        s_walletInfo[wallet] = newWallet;
        s_deployedWallets.push(wallet);
        s_ownerWallets[owner].push(wallet);

        emit WalletDeployed(wallet, owner, agent, block.timestamp);
    }

    /**
     * @notice Get wallet information by address
     * @param wallet Address of the wallet
     * @return WalletInfo struct containing wallet details
     */
    function getWalletInfo(address wallet) external view returns (WalletInfo memory) {
        return s_walletInfo[wallet];
    }

    /**
     * @notice Get all wallets owned by an address
     * @param owner Address of the owner
     * @return Array of wallet addresses owned by the owner
     */
    function getOwnerWallets(address owner) external view returns (address[] memory) {
        return s_ownerWallets[owner];
    }

    /**
     * @notice Get all deployed wallets
     * @return Array of all deployed wallet addresses
     */
    function getAllWallets() external view returns (address[] memory) {
        return s_deployedWallets;
    }

    /**
     * @notice Get total number of deployed wallets
     * @return Total number of wallets deployed
     */
    function getTotalWallets() external view returns (uint256) {
        return s_deployedWallets.length;
    }

    /**
     * @notice Check if an address is a deployed wallet
     * @param wallet Address to check
     * @return bool True if the address is a deployed wallet
     */
    function isDeployedWallet(address wallet) external view returns (bool) {
        return s_walletInfo[wallet].walletAddress != address(0);
    }
}
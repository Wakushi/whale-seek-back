// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import { IUniswapV3Factory } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/**
 * ==================== Contract Addresses ====================
 * 
 * Network          | Contract | Address
 * -----------------|----------|----------------------------------
 * Base Mainnet     | Factory  | 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
 *                  | Router   | 0x2626664c2603336E57B271c5C0b26F421741e481
 *                  | USDC     | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 *                  | WETH     | 0x4200000000000000000000000000000000000006
 */

contract WhaleSeekWallet is Ownable {
    using SafeERC20 for IERC20;

    struct Swap {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 executedAt;
    }

    address private s_agent;
    uint256 private swapCount;
    mapping(uint256 swapId => Swap) private s_swaps;

    IUniswapV3Factory private constant i_uniswapFactory = IUniswapV3Factory(0x33128a8fC17869897dcE68Ed026d694621f6FDfD);
    ISwapRouter02 private constant router = ISwapRouter02(0x2626664c2603336E57B271c5C0b26F421741e481);

    error WhaleSeek__NotAgent();
    error WhaleSeek__TransferFailed();
    error WhaleSeek__ZeroAddress();
    error WhaleSeek__ZeroAmount();
    error WhaleSeek__InsufficientBalance();
    error WhaleSeek__SwapFailed();
    error WhaleSeek__ApprovalFailed();
    error WhaleSeek__PoolNotFound();
    
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event EthWithdrawn(address indexed to, uint256 amount);
    event SwapFailed(string indexed reason);
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 indexed amountIn
    );

    constructor(address _owner, address _agent) Ownable(_owner) {
        if(_agent == address(0)) revert WhaleSeek__ZeroAddress();

        s_agent = _agent;
    }

    receive() external payable {}

    fallback() external payable {}

    function mockSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) external {

        _ensureOnlyAgentOrOwner();
        
        s_swaps[swapCount] = Swap(tokenIn, tokenOut, amountIn, block.timestamp);
        swapCount++;

        emit SwapExecuted(tokenIn, tokenOut, amountIn);

    }

    function swapExactInputSingleHop(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin)
        external
    {
        _ensureOnlyAgentOrOwner();

        IERC20(tokenIn).approve(address(router), amountIn);

        ISwapRouter02.ExactInputSingleParams memory params = ISwapRouter02
            .ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: 3000,
            recipient: address(this),
            amountIn: amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });

        router.exactInputSingle(params);

        s_swaps[swapCount] = Swap(tokenIn, tokenOut, amountIn, block.timestamp);
        swapCount++;

        emit SwapExecuted(tokenIn, tokenOut, amountIn);
    }

    function withdrawERC20(address _token, address _to, uint256 _amount) external onlyOwner {
        if(_token == address(0)) revert WhaleSeek__ZeroAddress();
        if(_to == address(0)) revert WhaleSeek__ZeroAddress();
        if(_amount == 0) revert WhaleSeek__ZeroAmount();
        
        IERC20 token = IERC20(_token);

        uint256 balance = token.balanceOf(address(this));

        if(balance < _amount) revert WhaleSeek__InsufficientBalance();

        token.safeTransfer(_to, _amount);
        
        emit TokensWithdrawn(_token, _to, _amount);
    }

    function withdrawEth(address _to, uint256 _amount) external onlyOwner {
        if(_to == address(0)) revert WhaleSeek__ZeroAddress();
        if(_amount == 0) revert WhaleSeek__ZeroAmount();
        
        uint256 balance = address(this).balance;
        if(balance < _amount) revert WhaleSeek__InsufficientBalance();

        (bool success, ) = _to.call{value: _amount}("");
        if(!success) revert WhaleSeek__TransferFailed();

        emit EthWithdrawn(_to, _amount);
    }

    function _ensureOnlyAgentOrOwner() private view {
        if(msg.sender != s_agent && msg.sender != owner()) {
            revert WhaleSeek__NotAgent();
        }
    }

    function checkPool(address _tokenIn, address _tokenOut, uint24 _fee) external view returns (address) {
        address pool = i_uniswapFactory.getPool(_tokenIn, _tokenOut, _fee);
        return pool;
    }

    function checkLiquidity(address _tokenIn, address _tokenOut, uint24 _fee) external view returns (uint128) {
        address pool = i_uniswapFactory.getPool(_tokenIn, _tokenOut, _fee);

        if(pool == address(0)) return 0;
        
        return IUniswapV3Pool(pool).liquidity();
    }

    function getPoolPrice(address _tokenIn, address _tokenOut, uint24 _fee) external view returns (uint160) {
        address pool = i_uniswapFactory.getPool(_tokenIn, _tokenOut, _fee);
        if(pool == address(0)) return 0;
        
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
        return sqrtPriceX96;
    }

    function getSwap(uint256 _swapId) external view returns(Swap memory){
        return s_swaps[_swapId];
    }

    function getSwapId() external view returns(uint256){
        return swapCount;
    }


}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        returns (uint256 amountIn);
}

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}
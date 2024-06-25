"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuoteThroughNativePool = exports.IOnChainGasModelFactory = exports.IV2GasModelFactory = exports.usdGasTokensByChain = void 0;
const sdk_core_1 = require("@uniswap/sdk-core");
const token_provider_1 = require("../../../providers/token-provider");
const util_1 = require("../../../util");
// When adding new usd gas tokens, ensure the tokens are ordered
// from tokens with highest decimals to lowest decimals. For example,
// DAI_AVAX has 18 decimals and comes before USDC_AVAX which has 6 decimals.
exports.usdGasTokensByChain = {
    [sdk_core_1.ChainId.MAINNET]: [token_provider_1.DAI_MAINNET, token_provider_1.USDC_MAINNET, token_provider_1.USDT_MAINNET],
    [sdk_core_1.ChainId.ARBITRUM_ONE]: [
        token_provider_1.DAI_ARBITRUM,
        token_provider_1.USDC_ARBITRUM,
        token_provider_1.USDC_NATIVE_ARBITRUM,
        token_provider_1.USDT_ARBITRUM,
    ],
    [sdk_core_1.ChainId.OPTIMISM]: [
        token_provider_1.DAI_OPTIMISM,
        token_provider_1.USDC_OPTIMISM,
        token_provider_1.USDC_NATIVE_OPTIMISM,
        token_provider_1.USDT_OPTIMISM,
    ],
    [sdk_core_1.ChainId.OPTIMISM_GOERLI]: [
        token_provider_1.DAI_OPTIMISM_GOERLI,
        token_provider_1.USDC_OPTIMISM_GOERLI,
        token_provider_1.USDT_OPTIMISM_GOERLI,
    ],
    [sdk_core_1.ChainId.OPTIMISM_SEPOLIA]: [
        token_provider_1.USDC_OPTIMISM_SEPOLIA,
        token_provider_1.USDT_OPTIMISM_SEPOLIA,
    ],
    [sdk_core_1.ChainId.ARBITRUM_GOERLI]: [token_provider_1.USDC_ARBITRUM_GOERLI],
    [sdk_core_1.ChainId.ARBITRUM_SEPOLIA]: [token_provider_1.USDC_ARBITRUM_SEPOLIA],
    [sdk_core_1.ChainId.GOERLI]: [token_provider_1.DAI_GOERLI, token_provider_1.USDC_GOERLI, token_provider_1.USDT_GOERLI, token_provider_1.WBTC_GOERLI],
    [sdk_core_1.ChainId.SEPOLIA]: [token_provider_1.USDC_SEPOLIA, token_provider_1.DAI_SEPOLIA],
    [sdk_core_1.ChainId.POLYGON]: [token_provider_1.USDC_POLYGON, token_provider_1.USDC_NATIVE_POLYGON],
    [sdk_core_1.ChainId.POLYGON_MUMBAI]: [token_provider_1.DAI_POLYGON_MUMBAI],
    [sdk_core_1.ChainId.CELO]: [token_provider_1.CUSD_CELO, token_provider_1.USDC_CELO, token_provider_1.USDC_NATIVE_CELO, token_provider_1.USDC_WORMHOLE_CELO],
    [sdk_core_1.ChainId.CELO_ALFAJORES]: [token_provider_1.CUSD_CELO_ALFAJORES],
    [sdk_core_1.ChainId.GNOSIS]: [token_provider_1.USDC_ETHEREUM_GNOSIS],
    [sdk_core_1.ChainId.MOONBEAM]: [token_provider_1.USDC_MOONBEAM],
    [sdk_core_1.ChainId.BNB]: [token_provider_1.USDT_BNB, token_provider_1.USDC_BNB, token_provider_1.DAI_BNB],
    [sdk_core_1.ChainId.AVALANCHE]: [
        token_provider_1.DAI_AVAX,
        token_provider_1.USDC_AVAX,
        token_provider_1.USDC_NATIVE_AVAX,
        token_provider_1.USDC_BRIDGED_AVAX,
    ],
    [sdk_core_1.ChainId.BASE]: [token_provider_1.USDC_BASE, token_provider_1.USDC_NATIVE_BASE],
    [sdk_core_1.ChainId.BLAST]: [token_provider_1.USDB_BLAST],
    [sdk_core_1.ChainId.ZORA]: [token_provider_1.USDC_ZORA],
    [sdk_core_1.ChainId.ZKSYNC]: [token_provider_1.DAI_ZKSYNC, token_provider_1.USDCE_ZKSYNC, token_provider_1.USDC_ZKSYNC],
};
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IV2GasModelFactory
 */
class IV2GasModelFactory {
}
exports.IV2GasModelFactory = IV2GasModelFactory;
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IOnChainGasModelFactory
 */
class IOnChainGasModelFactory {
}
exports.IOnChainGasModelFactory = IOnChainGasModelFactory;
// Determines if native currency is token0
// Gets the native price of the pool, dependent on 0 or 1
// quotes across the pool
const getQuoteThroughNativePool = (chainId, nativeTokenAmount, nativeTokenPool) => {
    const nativeCurrency = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
    const isToken0 = nativeTokenPool.token0.equals(nativeCurrency);
    // returns mid price in terms of the native currency (the ratio of token/nativeToken)
    const nativeTokenPrice = isToken0
        ? nativeTokenPool.token0Price
        : nativeTokenPool.token1Price;
    // return gas cost in terms of the non native currency
    return nativeTokenPrice.quote(nativeTokenAmount);
};
exports.getQuoteThroughNativePool = getQuoteThroughNativePool;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLW1vZGVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2dhcy1tb2RlbHMvZ2FzLW1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdEQUkyQjtBQUszQixzRUE4QzJDO0FBTTNDLHdDQUF3RDtBQVN4RCxnRUFBZ0U7QUFDaEUscUVBQXFFO0FBQ3JFLDRFQUE0RTtBQUMvRCxRQUFBLG1CQUFtQixHQUF1QztJQUNyRSxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyw0QkFBVyxFQUFFLDZCQUFZLEVBQUUsNkJBQVksQ0FBQztJQUM1RCxDQUFDLGtCQUFPLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDdEIsNkJBQVk7UUFDWiw4QkFBYTtRQUNiLHFDQUFvQjtRQUNwQiw4QkFBYTtLQUNkO0lBQ0QsQ0FBQyxrQkFBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1FBQ2xCLDZCQUFZO1FBQ1osOEJBQWE7UUFDYixxQ0FBb0I7UUFDcEIsOEJBQWE7S0FDZDtJQUNELENBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUN6QixvQ0FBbUI7UUFDbkIscUNBQW9CO1FBQ3BCLHFDQUFvQjtLQUNyQjtJQUNELENBQUMsa0JBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQzFCLHNDQUFxQjtRQUNyQixzQ0FBcUI7S0FDdEI7SUFDRCxDQUFDLGtCQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxxQ0FBb0IsQ0FBQztJQUNqRCxDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLHNDQUFxQixDQUFDO0lBQ25ELENBQUMsa0JBQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLDJCQUFVLEVBQUUsNEJBQVcsRUFBRSw0QkFBVyxFQUFFLDRCQUFXLENBQUM7SUFDckUsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsNkJBQVksRUFBRSw0QkFBVyxDQUFDO0lBQzlDLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLDZCQUFZLEVBQUUsb0NBQW1CLENBQUM7SUFDdEQsQ0FBQyxrQkFBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsbUNBQWtCLENBQUM7SUFDOUMsQ0FBQyxrQkFBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsMEJBQVMsRUFBRSwwQkFBUyxFQUFFLGlDQUFnQixFQUFFLG1DQUFrQixDQUFDO0lBQzVFLENBQUMsa0JBQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLG9DQUFtQixDQUFDO0lBQy9DLENBQUMsa0JBQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLHFDQUFvQixDQUFDO0lBQ3hDLENBQUMsa0JBQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLDhCQUFhLENBQUM7SUFDbkMsQ0FBQyxrQkFBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMseUJBQVEsRUFBRSx5QkFBUSxFQUFFLHdCQUFPLENBQUM7SUFDNUMsQ0FBQyxrQkFBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQ25CLHlCQUFRO1FBQ1IsMEJBQVM7UUFDVCxpQ0FBZ0I7UUFDaEIsa0NBQWlCO0tBQ2xCO0lBQ0QsQ0FBQyxrQkFBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsMEJBQVMsRUFBRSxpQ0FBZ0IsQ0FBQztJQUM3QyxDQUFDLGtCQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQywyQkFBVSxDQUFDO0lBQzdCLENBQUMsa0JBQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLDBCQUFTLENBQUM7SUFDM0IsQ0FBQyxrQkFBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsMkJBQVUsRUFBRSw2QkFBWSxFQUFFLDRCQUFXLENBQUM7Q0FDMUQsQ0FBQztBQTZFRjs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBc0Isa0JBQWtCO0NBUXZDO0FBUkQsZ0RBUUM7QUFFRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBc0IsdUJBQXVCO0NBYTVDO0FBYkQsMERBYUM7QUFFRCwwQ0FBMEM7QUFDMUMseURBQXlEO0FBQ3pELHlCQUF5QjtBQUNsQixNQUFNLHlCQUF5QixHQUFHLENBQ3ZDLE9BQWdCLEVBQ2hCLGlCQUEyQyxFQUMzQyxlQUE0QixFQUNaLEVBQUU7SUFDbEIsTUFBTSxjQUFjLEdBQUcsOEJBQXVCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDeEQsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDL0QscUZBQXFGO0lBQ3JGLE1BQU0sZ0JBQWdCLEdBQUcsUUFBUTtRQUMvQixDQUFDLENBQUMsZUFBZSxDQUFDLFdBQVc7UUFDN0IsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUM7SUFDaEMsc0RBQXNEO0lBQ3RELE9BQU8sZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFtQixDQUFDO0FBQ3JFLENBQUMsQ0FBQztBQWJXLFFBQUEseUJBQXlCLDZCQWFwQyJ9
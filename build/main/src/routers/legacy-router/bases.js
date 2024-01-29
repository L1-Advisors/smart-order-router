"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOM_BASES = exports.ADDITIONAL_BASES = exports.BASES_TO_CHECK_TRADES_AGAINST = void 0;
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const sdk_core_1 = require("@uniswap/sdk-core");
const token_provider_1 = require("../../providers/token-provider");
const chains_1 = require("../../util/chains");
const BASES_TO_CHECK_TRADES_AGAINST = (_tokenProvider) => {
    return {
        [sdk_core_1.ChainId.MAINNET]: [
            chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.MAINNET],
            token_provider_1.DAI_MAINNET,
            token_provider_1.USDC_MAINNET,
            token_provider_1.USDT_MAINNET,
            token_provider_1.WBTC_MAINNET,
        ],
        [sdk_core_1.ChainId.GOERLI]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.GOERLI]],
        [sdk_core_1.ChainId.SEPOLIA]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.SEPOLIA]],
        [sdk_core_1.ChainId.OPTIMISM]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.OPTIMISM]],
        [sdk_core_1.ChainId.OPTIMISM_SEPOLIA]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.OPTIMISM_SEPOLIA]],
        [sdk_core_1.ChainId.OPTIMISM_GOERLI]: [
            chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.OPTIMISM_GOERLI],
        ],
        [sdk_core_1.ChainId.ARBITRUM_ONE]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.ARBITRUM_ONE]],
        [sdk_core_1.ChainId.ARBITRUM_GOERLI]: [
            chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.ARBITRUM_GOERLI],
        ],
        [sdk_core_1.ChainId.POLYGON]: [token_provider_1.WMATIC_POLYGON],
        [sdk_core_1.ChainId.POLYGON_MUMBAI]: [token_provider_1.WMATIC_POLYGON_MUMBAI],
        [sdk_core_1.ChainId.CELO]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.CELO]],
        [sdk_core_1.ChainId.CELO_ALFAJORES]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.CELO_ALFAJORES]],
        [sdk_core_1.ChainId.GNOSIS]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.GNOSIS]],
        [sdk_core_1.ChainId.MOONBEAM]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.MOONBEAM]],
        [sdk_core_1.ChainId.BNB]: [
            chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.BNB],
            token_provider_1.BUSD_BNB,
            token_provider_1.DAI_BNB,
            token_provider_1.USDC_BNB,
            token_provider_1.USDT_BNB,
            token_provider_1.BTC_BNB,
        ],
        [sdk_core_1.ChainId.AVALANCHE]: [
            chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.AVALANCHE],
            token_provider_1.USDC_AVAX,
            token_provider_1.DAI_AVAX,
        ],
        [sdk_core_1.ChainId.BASE]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.BASE], token_provider_1.USDC_BASE],
        [sdk_core_1.ChainId.BASE_GOERLI]: [chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.BASE_GOERLI]],
    };
};
exports.BASES_TO_CHECK_TRADES_AGAINST = BASES_TO_CHECK_TRADES_AGAINST;
const getBasePairByAddress = async (tokenProvider, _chainId, fromAddress, toAddress) => {
    const accessor = await tokenProvider.getTokens([toAddress]);
    const toToken = accessor.getTokenByAddress(toAddress);
    if (!toToken)
        return {};
    return {
        [fromAddress]: [toToken],
    };
};
const ADDITIONAL_BASES = async (tokenProvider) => {
    return {
        [sdk_core_1.ChainId.MAINNET]: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0xA948E86885e12Fb09AfEF8C52142EBDbDf73cD18', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'))), (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0x561a4717537ff4AF5c687328c0f7E90a319705C0', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'))), (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0x956F47F50A910163D8BF957Cf5846D573E7f87CA', '0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B'))), (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B', '0x956F47F50A910163D8BF957Cf5846D573E7f87CA'))), (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0x853d955acef822db058eb8505911ed77f175b99e', '0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0'))), (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0', '0x853d955acef822db058eb8505911ed77f175b99e'))), (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d'))), (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d', '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'))),
    };
};
exports.ADDITIONAL_BASES = ADDITIONAL_BASES;
/**
 * Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
 * tokens.
 */
const CUSTOM_BASES = async (tokenProvider) => {
    return {
        [sdk_core_1.ChainId.MAINNET]: Object.assign(Object.assign({}, (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0xd46ba6d942050d489dbd938a2c909a5d5039a161', token_provider_1.DAI_MAINNET.address))), (await getBasePairByAddress(tokenProvider, sdk_core_1.ChainId.MAINNET, '0xd46ba6d942050d489dbd938a2c909a5d5039a161', chains_1.WRAPPED_NATIVE_CURRENCY[1].address))),
    };
};
exports.CUSTOM_BASES = CUSTOM_BASES;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcm91dGVycy9sZWdhY3ktcm91dGVyL2Jhc2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZEQUE2RDtBQUM3RCxnREFBbUQ7QUFFbkQsbUVBZ0J3QztBQUN4Qyw4Q0FBNEQ7QUFNckQsTUFBTSw2QkFBNkIsR0FBRyxDQUMzQyxjQUE4QixFQUNkLEVBQUU7SUFDbEIsT0FBTztRQUNMLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUNqQixnQ0FBdUIsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBRTtZQUN6Qyw0QkFBVztZQUNYLDZCQUFZO1lBQ1osNkJBQVk7WUFDWiw2QkFBWTtTQUNiO1FBQ0QsQ0FBQyxrQkFBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsZ0NBQXVCLENBQUMsa0JBQU8sQ0FBQyxNQUFNLENBQUUsQ0FBQztRQUM1RCxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxnQ0FBdUIsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBRSxDQUFDO1FBQzlELENBQUMsa0JBQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLGdDQUF1QixDQUFDLGtCQUFPLENBQUMsUUFBUSxDQUFFLENBQUM7UUFDaEUsQ0FBQyxrQkFBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxnQ0FBdUIsQ0FBQyxrQkFBTyxDQUFDLGdCQUFnQixDQUFFLENBQUM7UUFDaEYsQ0FBQyxrQkFBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1lBQ3pCLGdDQUF1QixDQUFDLGtCQUFPLENBQUMsZUFBZSxDQUFFO1NBQ2xEO1FBQ0QsQ0FBQyxrQkFBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsZ0NBQXVCLENBQUMsa0JBQU8sQ0FBQyxZQUFZLENBQUUsQ0FBQztRQUN4RSxDQUFDLGtCQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7WUFDekIsZ0NB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
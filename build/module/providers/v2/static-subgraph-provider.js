import { ChainId } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import _ from 'lodash';
import { WRAPPED_NATIVE_CURRENCY } from '../../util/chains';
import { log } from '../../util/log';
import { DAI_MAINNET, USDC_MAINNET, USDT_MAINNET, WBTC_MAINNET, } from '../token-provider';
const BASES_TO_CHECK_TRADES_AGAINST = {
    [ChainId.MAINNET]: [
        WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET],
        DAI_MAINNET,
        USDC_MAINNET,
        USDT_MAINNET,
        WBTC_MAINNET,
    ],
    [ChainId.GOERLI]: [WRAPPED_NATIVE_CURRENCY[ChainId.GOERLI]],
    [ChainId.SEPOLIA]: [WRAPPED_NATIVE_CURRENCY[ChainId.SEPOLIA]],
    //v2 not deployed on [optimism, arbitrum, polygon, celo, gnosis, moonbeam, bnb, avalanche] and their testnets
    [ChainId.OPTIMISM]: [],
    [ChainId.ARBITRUM_ONE]: [],
    [ChainId.ARBITRUM_GOERLI]: [],
    [ChainId.OPTIMISM_GOERLI]: [],
    [ChainId.POLYGON]: [],
    [ChainId.POLYGON_MUMBAI]: [],
    [ChainId.CELO]: [],
    [ChainId.CELO_ALFAJORES]: [],
    [ChainId.GNOSIS]: [],
    [ChainId.MOONBEAM]: [],
    [ChainId.BNB]: [],
    [ChainId.AVALANCHE]: [],
    [ChainId.BASE_GOERLI]: [],
    [ChainId.BASE]: [],
};
/**
 * Provider that does not get data from an external source and instead returns
 * a hardcoded list of Subgraph pools.
 *
 * Since the pools are hardcoded, the liquidity/price values are dummys and should not
 * be depended on.
 *
 * Useful for instances where other data sources are unavailable. E.g. subgraph not available.
 *
 * @export
 * @class StaticV2SubgraphProvider
 */
export class StaticV2SubgraphProvider {
    constructor(chainId) {
        this.chainId = chainId;
    }
    async getPools(tokenIn, tokenOut) {
        log.info('In static subgraph provider for V2');
        const bases = BASES_TO_CHECK_TRADES_AGAINST[this.chainId];
        const basePairs = _.flatMap(bases, (base) => bases.map((otherBase) => [base, otherBase]));
        if (tokenIn && tokenOut) {
            basePairs.push([tokenIn, tokenOut], ...bases.map((base) => [tokenIn, base]), ...bases.map((base) => [tokenOut, base]));
        }
        const pairs = _(basePairs)
            .filter((tokens) => Boolean(tokens[0] && tokens[1]))
            .filter(([tokenA, tokenB]) => tokenA.address !== tokenB.address && !tokenA.equals(tokenB))
            .value();
        const poolAddressSet = new Set();
        const subgraphPools = _(pairs)
            .map(([tokenA, tokenB]) => {
            const poolAddress = Pair.getAddress(tokenA, tokenB);
            if (poolAddressSet.has(poolAddress)) {
                return undefined;
            }
            poolAddressSet.add(poolAddress);
            const [token0, token1] = tokenA.sortsBefore(tokenB)
                ? [tokenA, tokenB]
                : [tokenB, tokenA];
            return {
                id: poolAddress,
                liquidity: '100',
                token0: {
                    id: token0.address,
                },
                token1: {
                    id: token1.address,
                },
                supply: 100,
                reserve: 100,
                reserveUSD: 100,
            };
        })
            .compact()
            .value();
        return subgraphPools;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljLXN1YmdyYXBoLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy92Mi9zdGF0aWMtc3ViZ3JhcGgtcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLG1CQUFtQixDQUFDO0FBQ25ELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFFdkIsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDNUQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3JDLE9BQU8sRUFDTCxXQUFXLEVBQ1gsWUFBWSxFQUNaLFlBQVksRUFDWixZQUFZLEdBQ2IsTUFBTSxtQkFBbUIsQ0FBQztBQVEzQixNQUFNLDZCQUE2QixHQUFtQjtJQUNwRCxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNqQix1QkFBdUIsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFFO1FBQ3pDLFdBQVc7UUFDWCxZQUFZO1FBQ1osWUFBWTtRQUNaLFlBQVk7S0FDYjtJQUNELENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsdUJBQXVCLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBRSxDQUFDO0lBQzVELENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsdUJBQXVCLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBRSxDQUFDO0lBQzlELDZHQUE2RztJQUM3RyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFO0lBQ3RCLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUU7SUFDMUIsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsRUFBRTtJQUM3QixDQUFDLE9BQU8sQ0FBQyxlQUFlLENB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
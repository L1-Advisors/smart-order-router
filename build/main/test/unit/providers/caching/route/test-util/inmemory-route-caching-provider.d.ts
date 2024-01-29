import { Protocol } from '@uniswap/router-sdk';
import { ChainId, Currency, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core';
import { CachedRoutes, CacheMode, IRouteCachingProvider } from '../../../../../../src';
export declare class InMemoryRouteCachingProvider extends IRouteCachingProvider {
    routesCache: Map<string, CachedRoutes>;
    blocksToLive: number;
    cacheMode: CacheMode;
    forceFail: boolean;
    internalGetCacheRouteCalls: number;
    internalSetCacheRouteCalls: number;
    getCacheModeCalls: number;
    protected _getBlocksToLive(_cachedRoutes: CachedRoutes, _amount: CurrencyAmount<Currency>): Promise<number>;
    protected _getCachedRoute(chainId: ChainId, amount: CurrencyAmount<Currency>, quoteToken: Token, tradeType: TradeType, protocols: Protocol[]): Promise<CachedRoutes | undefined>;
    protected _setCachedRoute(cachedRoutes: CachedRoutes, _amount: CurrencyAmount<Currency>): Promise<boolean>;
    getCacheMode(_chainId: ChainId, _amount: CurrencyAmount<Currency>, _quoteToken: Token, _tradeType: TradeType, _protocols: Protocol[]): Promise<CacheMode>;
}

import { Protocol } from '@uniswap/router-sdk';
import { CurrencyAmount, TradeType } from '@uniswap/sdk-core';
import { DAI_MAINNET as DAI, USDC_MAINNET as USDC, WBTC_MAINNET as WBTC } from '../../../../../build/main';
import { CachedRoutes, CacheMode } from '../../../../../src';
import { InMemoryRouteCachingProvider } from './test-util/inmemory-route-caching-provider';
import { getCachedRoutesStub } from './test-util/mocked-dependencies';
describe('RouteCachingProvider', () => {
    let routeCachingProvider;
    let blockNumber = 1;
    beforeEach(() => {
        routeCachingProvider = new InMemoryRouteCachingProvider();
    });
    describe('.setCachedRoute', () => {
        describe('with cacheMode == Darkmode', () => {
            let uncachedRoute;
            beforeEach(() => {
                uncachedRoute = getCachedRoutesStub(blockNumber);
            });
            it('fails to insert cachedRoutes in the cache', async () => {
                const cacheSuccess = await routeCachingProvider.setCachedRoute(uncachedRoute, CurrencyAmount.fromRawAmount(USDC, 100));
                expect(cacheSuccess).toBeFalsy();
                expect(routeCachingProvider.internalSetCacheRouteCalls).toEqual(0);
                expect(routeCachingProvider.getCacheModeCalls).toEqual(1);
            });
            it('does not update cachedRoutes.blocksToLive before inserting in cache', async () => {
                expect(uncachedRoute.blocksToLive).toEqual(0);
                await routeCachingProvider.setCachedRoute(uncachedRoute, CurrencyAmount.fromRawAmount(USDC, 100));
                expect(uncachedRoute.blocksToLive).toEqual(0);
            });
        });
        [CacheMode.Livemode, CacheMode.Tapcompare].forEach((cacheMode) => {
            describe(`with cacheMode == ${cacheMode}`, () => {
                let uncachedRoute;
                beforeEach(() => {
                    routeCachingProvider.cacheMode = cacheMode;
                    uncachedRoute = getCachedRoutesStub(blockNumber);
                });
                it('obtains the cacheMode internally', async () => {
                    await routeCachingProvider.setCachedRoute(uncachedRoute, CurrencyAmount.fromRawAmount(USDC, 100));
                    expect(routeCachingProvider.getCacheModeCalls).toEqual(1);
                });
                it('updates cachedRoutes.blocksToLive before inserting in cache', async () => {
                    expect(uncachedRoute.blocksToLive).toEqual(0);
                    await routeCachingProvider.setCachedRoute(uncachedRoute, CurrencyAmount.fromRawAmount(USDC, 100));
                    expect(uncachedRoute.blocksToLive).not.toEqual(0);
                    expect(uncachedRoute.blocksToLive).toEqual(routeCachingProvider.blocksToLive);
                });
                it('inserts cachedRoutes in the cache', async () => {
                    const cacheSuccess = await routeCachingProvider.setCachedRoute(uncachedRoute, CurrencyAmount.fromRawAmount(USDC, 100));
                    expect(cacheSuccess).toBeTruthy();
                    expect(routeCachingProvider.internalSetCacheRouteCalls).toEqual(1);
                });
                it('returns false when cache insertion fails', async () => {
                    routeCachingProvider.forceFail = true;
                    const cacheSuccess = await routeCachingProvider.setCachedRoute(uncachedRoute, CurrencyAmount.fromRawAmount(USDC, 100));
                    expect(cacheSuccess).toBeFalsy();
                    expect(routeCachingProvider.internalSetCacheRouteCalls).toEqual(1);
                });
            });
        });
    });
    describe('.getCachedRoute', () => {
        describe('with route in cache', () => {
            let cachedRoute;
            beforeEach(async () => {
                routeCachingProvider.cacheMode = CacheMode.Livemode; // set to livemode in order to test.
                cachedRoute = getCachedRoutesStub(blockNumber);
                await routeCachingProvider.setCachedRoute(cachedRoute, CurrencyAmount.fromRawAmount(USDC, 100));
            });
            it('gets the route in cache when requested', async () => {
                const route = await routeCachingProvider.getCachedRoute(cachedRoute.chainId, CurrencyAmount.fromRawAmount(USDC, 100), DAI, TradeType.EXACT_INPUT, [Protocol.V2, Protocol.MIXED, Protocol.V3], blockNumber);
                expect(route).toBeDefined();
                expect(route).toBeInstanceOf(CachedRoutes);
                expect(route).toEqual(cachedRoute);
                expect(routeCachingProvider.internalGetCacheRouteCalls).toEqual(1);
            });
            it('filtersOut expired cache entries', async () => {
                const route = await routeCachingProvider.getCachedRoute(cachedRoute.chainId, CurrencyAmount.fromRawAmount(USDC, 100), DAI, TradeType.EXACT_INPUT, [Protocol.V2, Protocol.MIXED, Protocol.V3], blockNumber + 100);
                expect(route).toBeUndefined();
                expect(routeCachingProvider.internalGetCacheRouteCalls).toEqual(1);
            });
            it('does not get the route for a different pair', async () => {
                const route = await routeCachingProvider.getCachedRoute(cachedRoute.chainId, CurrencyAmount.fromRawAmount(USDC, 100), WBTC, TradeType.EXACT_INPUT, [Protocol.V2, Protocol.MIXED, Protocol.V3], blockNumber);
                expect(route).toBeUndefined();
                expect(routeCachingProvider.internalGetCacheRouteCalls).toEqual(1);
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUtY2FjaGluZy1wcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9jYWNoaW5nL3JvdXRlL3JvdXRlLWNhY2hpbmctcHJvdmlkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsV0FBVyxJQUFJLEdBQUcsRUFBRSxZQUFZLElBQUksSUFBSSxFQUFFLFlBQVksSUFBSSxJQUFJLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMzRyxPQUFPLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzdELE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzNGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRXRFLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7SUFDcEMsSUFBSSxvQkFBa0QsQ0FBQztJQUN2RCxJQUFJLFdBQVcsR0FBVyxDQUFDLENBQUM7SUFFNUIsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLG9CQUFvQixHQUFHLElBQUksNEJBQTRCLEVBQUUsQ0FBQztJQUM1RCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUU7UUFDL0IsUUFBUSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtZQUMxQyxJQUFJLGFBQTJCLENBQUM7WUFFaEMsVUFBVSxDQUFDLEdBQUcsRUFBRTtnQkFDZCxhQUFhLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxDQUFFLENBQUM7WUFDcEQsQ0FBQyxDQUFDLENBQUM7WUFFSCxFQUFFLENB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
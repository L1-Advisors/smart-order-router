"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const main_1 = require("../../../../../build/main");
const src_1 = require("../../../../../src");
const inmemory_route_caching_provider_1 = require("./test-util/inmemory-route-caching-provider");
const mocked_dependencies_1 = require("./test-util/mocked-dependencies");
describe('RouteCachingProvider', () => {
    let routeCachingProvider;
    let blockNumber = 1;
    beforeEach(() => {
        routeCachingProvider = new inmemory_route_caching_provider_1.InMemoryRouteCachingProvider();
    });
    describe('.setCachedRoute', () => {
        describe('with cacheMode == Darkmode', () => {
            let uncachedRoute;
            beforeEach(() => {
                uncachedRoute = (0, mocked_dependencies_1.getCachedRoutesStub)(blockNumber);
            });
            it('fails to insert cachedRoutes in the cache', async () => {
                const cacheSuccess = await routeCachingProvider.setCachedRoute(uncachedRoute, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100));
                expect(cacheSuccess).toBeFalsy();
                expect(routeCachingProvider.internalSetCacheRouteCalls).toEqual(0);
                expect(routeCachingProvider.getCacheModeCalls).toEqual(1);
            });
            it('does not update cachedRoutes.blocksToLive before inserting in cache', async () => {
                expect(uncachedRoute.blocksToLive).toEqual(0);
                await routeCachingProvider.setCachedRoute(uncachedRoute, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100));
                expect(uncachedRoute.blocksToLive).toEqual(0);
            });
        });
        [src_1.CacheMode.Livemode, src_1.CacheMode.Tapcompare].forEach((cacheMode) => {
            describe(`with cacheMode == ${cacheMode}`, () => {
                let uncachedRoute;
                beforeEach(() => {
                    routeCachingProvider.cacheMode = cacheMode;
                    uncachedRoute = (0, mocked_dependencies_1.getCachedRoutesStub)(blockNumber);
                });
                it('obtains the cacheMode internally', async () => {
                    await routeCachingProvider.setCachedRoute(uncachedRoute, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100));
                    expect(routeCachingProvider.getCacheModeCalls).toEqual(1);
                });
                it('updates cachedRoutes.blocksToLive before inserting in cache', async () => {
                    expect(uncachedRoute.blocksToLive).toEqual(0);
                    await routeCachingProvider.setCachedRoute(uncachedRoute, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100));
                    expect(uncachedRoute.blocksToLive).not.toEqual(0);
                    expect(uncachedRoute.blocksToLive).toEqual(routeCachingProvider.blocksToLive);
                });
                it('inserts cachedRoutes in the cache', async () => {
                    const cacheSuccess = await routeCachingProvider.setCachedRoute(uncachedRoute, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100));
                    expect(cacheSuccess).toBeTruthy();
                    expect(routeCachingProvider.internalSetCacheRouteCalls).toEqual(1);
                });
                it('returns false when cache insertion fails', async () => {
                    routeCachingProvider.forceFail = true;
                    const cacheSuccess = await routeCachingProvider.setCachedRoute(uncachedRoute, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100));
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
                routeCachingProvider.cacheMode = src_1.CacheMode.Livemode; // set to livemode in order to test.
                cachedRoute = (0, mocked_dependencies_1.getCachedRoutesStub)(blockNumber);
                await routeCachingProvider.setCachedRoute(cachedRoute, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100));
            });
            it('gets the route in cache when requested', async () => {
                const route = await routeCachingProvider.getCachedRoute(cachedRoute.chainId, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100), main_1.DAI_MAINNET, sdk_core_1.TradeType.EXACT_INPUT, [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.MIXED, router_sdk_1.Protocol.V3], blockNumber);
                expect(route).toBeDefined();
                expect(route).toBeInstanceOf(src_1.CachedRoutes);
                expect(route).toEqual(cachedRoute);
                expect(routeCachingProvider.internalGetCacheRouteCalls).toEqual(1);
            });
            it('filtersOut expired cache entries', async () => {
                const route = await routeCachingProvider.getCachedRoute(cachedRoute.chainId, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100), main_1.DAI_MAINNET, sdk_core_1.TradeType.EXACT_INPUT, [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.MIXED, router_sdk_1.Protocol.V3], blockNumber + 100);
                expect(route).toBeUndefined();
                expect(routeCachingProvider.internalGetCacheRouteCalls).toEqual(1);
            });
            it('does not get the route for a different pair', async () => {
                const route = await routeCachingProvider.getCachedRoute(cachedRoute.chainId, sdk_core_1.CurrencyAmount.fromRawAmount(main_1.USDC_MAINNET, 100), main_1.WBTC_MAINNET, sdk_core_1.TradeType.EXACT_INPUT, [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.MIXED, router_sdk_1.Protocol.V3], blockNumber);
                expect(route).toBeUndefined();
                expect(routeCachingProvider.internalGetCacheRouteCalls).toEqual(1);
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUtY2FjaGluZy1wcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9jYWNoaW5nL3JvdXRlL3JvdXRlLWNhY2hpbmctcHJvdmlkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9EQUErQztBQUMvQyxnREFBOEQ7QUFDOUQsb0RBQTJHO0FBQzNHLDRDQUE2RDtBQUM3RCxpR0FBMkY7QUFDM0YseUVBQXNFO0FBRXRFLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7SUFDcEMsSUFBSSxvQkFBa0QsQ0FBQztJQUN2RCxJQUFJLFdBQVcsR0FBVyxDQUFDLENBQUM7SUFFNUIsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLG9CQUFvQixHQUFHLElBQUksOERBQTRCLEVBQUUsQ0FBQztJQUM1RCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUU7UUFDL0IsUUFBUSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtZQUMxQyxJQUFJLGFBQTJCLENBQUM7WUFFaEMsVUFBVSxDQUFDLEdBQUcsRUFBRTtnQkFDZCxhQUFhLEdBQUcsSUFBQSx5Q0FBbUIsRUFBQyxXQUFXLENBQUUsQ0FBQztZQUNwRCxDQUFDLENBQUMsQ0FBQztZQUVILEVBQUUsQ0FBQywyQ0FBMkMsRUFBRSxLQUFLLElBQUksRUFBRTtnQkFDekQsTUFBTSxZQUFZLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQyxjQUFjLENBQzVELGFBQWEsRUFDYix5QkFBYyxDQUFDLGFBQWEsQ0FBQyxtQkFBSSxFQUFFLEdBQUcsQ0FBQyxDQUN4QyxDQUFDO2dCQUVGLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDakMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLDBCQUEwQixDQUFDLENBQUMsT0FBTyxDQUFDLENB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
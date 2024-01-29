"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const src_1 = require("../../../../../../src");
const mocked_dependencies_1 = require("../test-util/mocked-dependencies");
describe('CachedRoutes', () => {
    let v3RouteWithValidQuote;
    const blockNumber = 1;
    beforeEach(() => {
        v3RouteWithValidQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)();
    });
    describe('#fromRoutesWithValidQuotes', () => {
        it('creates the instance', () => {
            const cachedRoutes = src_1.CachedRoutes.fromRoutesWithValidQuotes([v3RouteWithValidQuote], sdk_core_1.ChainId.MAINNET, src_1.USDC_MAINNET, src_1.DAI_MAINNET, [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.V3, router_sdk_1.Protocol.MIXED], blockNumber, sdk_core_1.TradeType.EXACT_INPUT, '1.1');
            expect(cachedRoutes).toBeInstanceOf(src_1.CachedRoutes);
        });
        it('returns undefined when routes are empty', () => {
            const cachedRoutes = src_1.CachedRoutes.fromRoutesWithValidQuotes([], sdk_core_1.ChainId.MAINNET, src_1.USDC_MAINNET, src_1.DAI_MAINNET, [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.V3, router_sdk_1.Protocol.MIXED], blockNumber, sdk_core_1.TradeType.EXACT_INPUT, '1.1');
            expect(cachedRoutes).toBeUndefined();
        });
    });
    describe('instance functions', () => {
        let cachedRoutes;
        beforeEach(() => {
            cachedRoutes = src_1.CachedRoutes.fromRoutesWithValidQuotes([v3RouteWithValidQuote], sdk_core_1.ChainId.MAINNET, src_1.USDC_MAINNET, src_1.DAI_MAINNET, [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.V3, router_sdk_1.Protocol.MIXED], blockNumber, sdk_core_1.TradeType.EXACT_INPUT, '1.1');
        });
        describe('.blocksToLive', () => {
            it('defaults to 0', () => {
                expect(cachedRoutes.blocksToLive).toEqual(0);
            });
            it('can be set', () => {
                cachedRoutes.blocksToLive = 10;
                expect(cachedRoutes.blocksToLive).toEqual(10);
            });
        });
        describe('.notExpired', () => {
            describe('with default blocksToLive', () => {
                it('returns true when blockNumber is still the same as the one in the cached routes', () => {
                    expect(cachedRoutes.notExpired(blockNumber)).toBeTruthy();
                });
                it('returns false when blockNumber has advanced from the one in the cached routes', () => {
                    expect(cachedRoutes.notExpired(blockNumber + 1)).toBeFalsy();
                });
            });
            describe('after blocksToLive is updated', () => {
                describe('with optimistic quotes set to "true"', () => {
                    let optimistic;
                    beforeEach(() => {
                        cachedRoutes.blocksToLive = 5;
                        optimistic = true;
                    });
                    it('returns true when blockNumber is still the same as the one in the cached routes', () => {
                        expect(cachedRoutes.notExpired(blockNumber, optimistic)).toBeTruthy();
                    });
                    it('returns true when blockNumber has advanced from the one in the cached routes less than BTL', () => {
                        expect(cachedRoutes.notExpired(blockNumber + 1, optimistic)).toBeTruthy();
                    });
                    it('returns true when blockNumber has advanced as many as blocksToLive number of blocks', () => {
                        expect(cachedRoutes.notExpired(blockNumber + cachedRoutes.blocksToLive, optimistic)).toBeTruthy();
                    });
                    it('returns false when blockNumber has advanced one more than BTL', () => {
                        expect(cachedRoutes.notExpired(blockNumber + cachedRoutes.blocksToLive + 1, optimistic)).toBeFalsy();
                    });
                });
                describe('with optimistic quotes set to "false"', () => {
                    // When we are not supporting optimistic quotes, blocksToLive is 0
                    let optimistic;
                    beforeEach(() => {
                        cachedRoutes.blocksToLive = 5;
                        optimistic = false;
                    });
                    it('returns true when blockNumber is still the same as the one in the cached routes', () => {
                        expect(cachedRoutes.notExpired(blockNumber, optimistic)).toBeTruthy();
                    });
                    it('returns false when blockNumber has advanced from the one in the cached routes less than BTL', () => {
                        expect(cachedRoutes.notExpired(blockNumber + 1, optimistic)).toBeFalsy();
                    });
                    it('returns false when blockNumber has advanced as many as blocksToLive number of blocks', () => {
                        expect(cachedRoutes.notExpired(blockNumber + cachedRoutes.blocksToLive, optimistic)).toBeFalsy();
                    });
                    it('returns false when blockNumber has advanced one more than BTL', () => {
                        expect(cachedRoutes.notExpired(blockNumber + cachedRoutes.blocksToLive + 1, optimistic)).toBeFalsy();
                    });
                });
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkLXJvdXRlcy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9jYWNoaW5nL3JvdXRlL21vZGVsL2NhY2hlZC1yb3V0ZXMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9EQUErQztBQUMvQyxnREFBdUQ7QUFFdkQsK0NBQStGO0FBQy9GLDBFQUFnRjtBQUVoRixRQUFRLENBQUMsY0FBYyxFQUFFLEdBQUcsRUFBRTtJQUM1QixJQUFJLHFCQUE0QyxDQUFDO0lBQ2pELE1BQU0sV0FBVyxHQUFXLENBQUMsQ0FBQztJQUU5QixVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2QscUJBQXFCLEdBQUcsSUFBQSxrREFBNEIsR0FBRSxDQUFDO0lBQ3pELENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtRQUMxQyxFQUFFLENBQUMsc0JBQXNCLEVBQUUsR0FBRyxFQUFFO1lBQzlCLE1BQU0sWUFBWSxHQUFHLGtCQUFZLENBQUMseUJBQXlCLENBQ3pELENBQUMscUJBQXFCLENBQUMsRUFDdkIsa0JBQU8sQ0FBQyxPQUFPLEVBQ2Ysa0JBQUksRUFDSixpQkFBRyxFQUNILENBQUMscUJBQVEsQ0FBQyxFQUFFLEVBQUUscUJBQVEsQ0FBQyxFQUFFLEVBQUUscUJBQVEsQ0FBQyxLQUFLLENBQUMsRUFDMUMsV0FBVyxFQUNYLG9CQUFTLENBQUMsV0FBVyxFQUNyQixLQUFLLENBQ04sQ0FBQztZQUVGLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxjQUFjLENBQUMsa0JBQVksQ0FBQyxDQUFDO1FBQ3BELENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLHlDQUF5QyxFQUFFLEdBQUcsRUFBRTtZQUNqRCxNQUFNLFlBQVksR0FBRyxrQkFBWSxDQUFDLHlCQUF5QixDQUN6RCxFQUFFLEVBQ0Ysa0JBQU8sQ0FBQyxP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
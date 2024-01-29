import { Protocol } from '@uniswap/router-sdk';
import { ChainId, TradeType } from '@uniswap/sdk-core';
import { CachedRoutes, DAI_MAINNET as DAI, USDC_MAINNET as USDC } from '../../../../../../src';
import { getV3RouteWithValidQuoteStub } from '../test-util/mocked-dependencies';
describe('CachedRoutes', () => {
    let v3RouteWithValidQuote;
    const blockNumber = 1;
    beforeEach(() => {
        v3RouteWithValidQuote = getV3RouteWithValidQuoteStub();
    });
    describe('#fromRoutesWithValidQuotes', () => {
        it('creates the instance', () => {
            const cachedRoutes = CachedRoutes.fromRoutesWithValidQuotes([v3RouteWithValidQuote], ChainId.MAINNET, USDC, DAI, [Protocol.V2, Protocol.V3, Protocol.MIXED], blockNumber, TradeType.EXACT_INPUT, '1.1');
            expect(cachedRoutes).toBeInstanceOf(CachedRoutes);
        });
        it('returns undefined when routes are empty', () => {
            const cachedRoutes = CachedRoutes.fromRoutesWithValidQuotes([], ChainId.MAINNET, USDC, DAI, [Protocol.V2, Protocol.V3, Protocol.MIXED], blockNumber, TradeType.EXACT_INPUT, '1.1');
            expect(cachedRoutes).toBeUndefined();
        });
    });
    describe('instance functions', () => {
        let cachedRoutes;
        beforeEach(() => {
            cachedRoutes = CachedRoutes.fromRoutesWithValidQuotes([v3RouteWithValidQuote], ChainId.MAINNET, USDC, DAI, [Protocol.V2, Protocol.V3, Protocol.MIXED], blockNumber, TradeType.EXACT_INPUT, '1.1');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkLXJvdXRlcy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9jYWNoaW5nL3JvdXRlL21vZGVsL2NhY2hlZC1yb3V0ZXMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDL0MsT0FBTyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUV2RCxPQUFPLEVBQUUsWUFBWSxFQUFFLFdBQVcsSUFBSSxHQUFHLEVBQUUsWUFBWSxJQUFJLElBQUksRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQy9GLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRWhGLFFBQVEsQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFO0lBQzVCLElBQUkscUJBQTRDLENBQUM7SUFDakQsTUFBTSxXQUFXLEdBQVcsQ0FBQyxDQUFDO0lBRTlCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxxQkFBcUIsR0FBRyw0QkFBNEIsRUFBRSxDQUFDO0lBQ3pELENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtRQUMxQyxFQUFFLENBQUMsc0JBQXNCLEVBQUUsR0FBRyxFQUFFO1lBQzlCLE1BQU0sWUFBWSxHQUFHLFlBQVksQ0FBQyx5QkFBeUIsQ0FDekQsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2QixPQUFPLENBQUMsT0FBTyxFQUNmLElBQUksRUFDSixHQUFHLEVBQ0gsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUMxQyxXQUFXLEVBQ1gsU0FBUyxDQUFDLFdBQVcsRUFDckIsS0FBSyxDQUNOLENBQUM7WUFFRixNQUFNLENBQUMsWUFBWSxDQUFD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
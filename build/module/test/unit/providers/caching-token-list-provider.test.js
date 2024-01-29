import { ChainId } from '@uniswap/sdk-core';
import _ from 'lodash';
import sinon from 'sinon';
import { CachingTokenListProvider, NodeJSCache, USDC_MAINNET as USDC, } from '../../../src';
import { mockTokenList } from '../../test-util/mock-data';
describe('caching token list provider', () => {
    let mockCache;
    let cachingTokenListProvider;
    beforeEach(async () => {
        mockCache = sinon.createStubInstance(NodeJSCache);
        cachingTokenListProvider = await CachingTokenListProvider.fromTokenList(ChainId.MAINNET, mockTokenList, mockCache);
    });
    describe('get tokens by address', () => {
        test('succeeds to get token and updates cache', async () => {
            const address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
            const token = await cachingTokenListProvider.getTokenByAddress(address);
            expect(token).toEqual(USDC);
            // Checks cache, then sets it with the token.
            sinon.assert.calledOnce(mockCache.get);
            sinon.assert.calledOnce(mockCache.set);
        });
        test('fails to get token that is in token list but not on the selected chain', async () => {
            const nonMainnetToken = _.filter(mockTokenList.tokens, (token) => token.chainId != ChainId.MAINNET)[0];
            const address = nonMainnetToken.address;
            const token = await cachingTokenListProvider.getTokenByAddress(address);
            expect(token).toBeUndefined();
            sinon.assert.notCalled(mockCache.get);
            sinon.assert.notCalled(mockCache.set);
        });
        test('succeeds for any chain id', async () => {
            cachingTokenListProvider = await CachingTokenListProvider.fromTokenList(777, mockTokenList, mockCache);
            const token = await cachingTokenListProvider.getTokenByAddress('0x577D296678535e4903D59A4C929B718e1D575e0A');
            expect(token).toBeDefined();
            expect(token.symbol).toEqual('WBTC');
            // Checks cache, then sets it with the token.
            sinon.assert.calledOnce(mockCache.get);
            sinon.assert.calledOnce(mockCache.set);
        });
        test('succeeds and is non case sensistive', async () => {
            const address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();
            const token = await cachingTokenListProvider.getTokenByAddress(address);
            expect(token).toEqual(USDC);
            // Checks cache, then sets it with the token.
            sinon.assert.calledOnce(mockCache.get);
            sinon.assert.calledOnce(mockCache.set);
        });
        test('succeeds to get token from cache', async () => {
            const address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
            mockCache.get
                .onFirstCall()
                .resolves(undefined)
                .onSecondCall()
                .resolves(USDC);
            await cachingTokenListProvider.getTokenByAddress(address);
            await cachingTokenListProvider.getTokenByAddress(address);
            mockCache.get.alwaysCalledWith(`token-list-token-1/Tokens/2021-01-05T20:47:02.923Z/1/${address.toLowerCase()}/6/USDC/USDC`);
            sinon.assert.calledTwice(mockCache.get);
            sinon.assert.calledOnce(mockCache.set);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGluZy10b2tlbi1saXN0LXByb3ZpZGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcHJvdmlkZXJzL2NhY2hpbmctdG9rZW4tbGlzdC1wcm92aWRlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxtQkFBbUIsQ0FBQztBQUNuRCxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFDdkIsT0FBTyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBQzFCLE9BQU8sRUFDTCx3QkFBd0IsRUFDeEIsV0FBVyxFQUNYLFlBQVksSUFBSSxJQUFJLEdBQ3JCLE1BQU0sY0FBYyxDQUFDO0FBQ3RCLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUUxRCxRQUFRLENBQUMsNkJBQTZCLEVBQUUsR0FBRyxFQUFFO0lBQzNDLElBQUksU0FBeUQsQ0FBQztJQUU5RCxJQUFJLHdCQUFrRCxDQUFDO0lBRXZELFVBQVUsQ0FBQyxLQUFLLElBQUksRUFBRTtRQUNwQixTQUFTLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRWxELHdCQUF3QixHQUFHLE1BQU0sd0JBQXdCLENBQUMsYUFBYSxDQUNyRSxPQUFPLENBQUMsT0FBTyxFQUNmLGFBQWEsRUFDYixTQUFTLENBQ1YsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLHVCQUF1QixFQUFFLEdBQUcsRUFBRTtRQUNyQyxJQUFJLENBQUMseUNBQXlDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDekQsTUFBTSxPQUFPLEdBQUcsNENBQTRDLENBQUM7WUFFN0QsTUFBTSxLQUFLLEdBQUcsTUFBTSx3QkFBd0IsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN4RSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFD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
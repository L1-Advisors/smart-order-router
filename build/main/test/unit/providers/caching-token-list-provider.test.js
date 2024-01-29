"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_core_1 = require("@uniswap/sdk-core");
const lodash_1 = __importDefault(require("lodash"));
const sinon_1 = __importDefault(require("sinon"));
const src_1 = require("../../../src");
const mock_data_1 = require("../../test-util/mock-data");
describe('caching token list provider', () => {
    let mockCache;
    let cachingTokenListProvider;
    beforeEach(async () => {
        mockCache = sinon_1.default.createStubInstance(src_1.NodeJSCache);
        cachingTokenListProvider = await src_1.CachingTokenListProvider.fromTokenList(sdk_core_1.ChainId.MAINNET, mock_data_1.mockTokenList, mockCache);
    });
    describe('get tokens by address', () => {
        test('succeeds to get token and updates cache', async () => {
            const address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
            const token = await cachingTokenListProvider.getTokenByAddress(address);
            expect(token).toEqual(src_1.USDC_MAINNET);
            // Checks cache, then sets it with the token.
            sinon_1.default.assert.calledOnce(mockCache.get);
            sinon_1.default.assert.calledOnce(mockCache.set);
        });
        test('fails to get token that is in token list but not on the selected chain', async () => {
            const nonMainnetToken = lodash_1.default.filter(mock_data_1.mockTokenList.tokens, (token) => token.chainId != sdk_core_1.ChainId.MAINNET)[0];
            const address = nonMainnetToken.address;
            const token = await cachingTokenListProvider.getTokenByAddress(address);
            expect(token).toBeUndefined();
            sinon_1.default.assert.notCalled(mockCache.get);
            sinon_1.default.assert.notCalled(mockCache.set);
        });
        test('succeeds for any chain id', async () => {
            cachingTokenListProvider = await src_1.CachingTokenListProvider.fromTokenList(777, mock_data_1.mockTokenList, mockCache);
            const token = await cachingTokenListProvider.getTokenByAddress('0x577D296678535e4903D59A4C929B718e1D575e0A');
            expect(token).toBeDefined();
            expect(token.symbol).toEqual('WBTC');
            // Checks cache, then sets it with the token.
            sinon_1.default.assert.calledOnce(mockCache.get);
            sinon_1.default.assert.calledOnce(mockCache.set);
        });
        test('succeeds and is non case sensistive', async () => {
            const address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();
            const token = await cachingTokenListProvider.getTokenByAddress(address);
            expect(token).toEqual(src_1.USDC_MAINNET);
            // Checks cache, then sets it with the token.
            sinon_1.default.assert.calledOnce(mockCache.get);
            sinon_1.default.assert.calledOnce(mockCache.set);
        });
        test('succeeds to get token from cache', async () => {
            const address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
            mockCache.get
                .onFirstCall()
                .resolves(undefined)
                .onSecondCall()
                .resolves(src_1.USDC_MAINNET);
            await cachingTokenListProvider.getTokenByAddress(address);
            await cachingTokenListProvider.getTokenByAddress(address);
            mockCache.get.alwaysCalledWith(`token-list-token-1/Tokens/2021-01-05T20:47:02.923Z/1/${address.toLowerCase()}/6/USDC/USDC`);
            sinon_1.default.assert.calledTwice(mockCache.get);
            sinon_1.default.assert.calledOnce(mockCache.set);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGluZy10b2tlbi1saXN0LXByb3ZpZGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcHJvdmlkZXJzL2NhY2hpbmctdG9rZW4tbGlzdC1wcm92aWRlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZ0RBQW1EO0FBQ25ELG9EQUF1QjtBQUN2QixrREFBMEI7QUFDMUIsc0NBSXNCO0FBQ3RCLHlEQUEwRDtBQUUxRCxRQUFRLENBQUMsNkJBQTZCLEVBQUUsR0FBRyxFQUFFO0lBQzNDLElBQUksU0FBeUQsQ0FBQztJQUU5RCxJQUFJLHdCQUFrRCxDQUFDO0lBRXZELFVBQVUsQ0FBQyxLQUFLLElBQUksRUFBRTtRQUNwQixTQUFTLEdBQUcsZUFBSyxDQUFDLGtCQUFrQixDQUFDLGlCQUFXLENBQUMsQ0FBQztRQUVsRCx3QkFBd0IsR0FBRyxNQUFNLDhCQUF3QixDQUFDLGFBQWEsQ0FDckUsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YseUJBQWEsRUFDYixTQUFTLENBQ1YsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLHVCQUF1QixFQUFFLEdBQUcsRUFBRTtRQUNyQyxJQUFJLENBQUMseUNBQXlDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDekQsTUFBTSxPQUFPLEdBQUcsNENBQTRDLENBQUM7WUFFN0QsTUFBTSxLQUFLLEdBQUcsTUFBTSx3QkFBd0IsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN4RSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLGtCQUFJLENBQUMsQ0FBQztZQUU1Qiw2Q0FBNkM7WUFDN0MsZUFBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZDLGVBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FB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
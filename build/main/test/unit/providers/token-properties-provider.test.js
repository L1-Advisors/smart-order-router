"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_core_1 = require("@uniswap/sdk-core");
const node_cache_1 = __importDefault(require("node-cache"));
const sinon_1 = __importDefault(require("sinon"));
const token_fee_fetcher_1 = require("../../../src/providers/token-fee-fetcher");
const bignumber_1 = require("@ethersproject/bignumber");
const src_1 = require("../../../src");
const dotenv_1 = __importDefault(require("dotenv"));
const providers_1 = require("@ethersproject/providers");
const mock_data_1 = require("../../test-util/mock-data");
dotenv_1.default.config();
describe('TokenPropertiesProvider', () => {
    let mockTokenFeeFetcher;
    const CACHE_KEY = (chainId, address) => `token-properties-${chainId}-${address}`;
    beforeEach(async () => {
        mockTokenFeeFetcher = sinon_1.default.createStubInstance(token_fee_fetcher_1.OnChainTokenFeeFetcher);
        mockTokenFeeFetcher.fetchFees.callsFake(async (addresses) => {
            const tokenToResult = {};
            addresses.forEach((address) => tokenToResult[address] = {
                buyFeeBps: bignumber_1.BigNumber.from(213),
                sellFeeBps: bignumber_1.BigNumber.from(800)
            });
            return tokenToResult;
        });
    });
    describe('get token fees by address', () => {
        it('succeeds to get token fee and updates cache', async () => {
            var _a;
            const underlyingCache = new node_cache_1.default({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new src_1.NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(sdk_core_1.ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const token = src_1.USDC_MAINNET;
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            expect(await tokenPropertiesResultCache.get(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()))).toBeUndefined();
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties([token], { enableFeeOnTransferFeeFetching: true });
            expect(tokenPropertiesMap[token.address.toLowerCase()]).toBeDefined();
            assertExpectedTokenProperties(tokenPropertiesMap[token.address.toLowerCase()], bignumber_1.BigNumber.from(213), bignumber_1.BigNumber.from(800), src_1.TokenValidationResult.FOT);
            const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()));
            expect(cachedTokenProperties).toBeDefined();
            assertExpectedTokenProperties(cachedTokenProperties, bignumber_1.BigNumber.from(213), bignumber_1.BigNumber.from(800), src_1.TokenValidationResult.FOT);
            underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()));
            expect(Math.floor(((_a = underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()))) !== null && _a !== void 0 ? _a : 0) / 1000)).toEqual(currentEpochTimeInSeconds + src_1.POSITIVE_CACHE_ENTRY_TTL);
        });
        it('succeeds to get token fee cache hit and second token fee fetcher call is skipped', async function () {
            var _a;
            const underlyingCache = new node_cache_1.default({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new src_1.NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(sdk_core_1.ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const token = src_1.USDC_MAINNET;
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            expect(await tokenPropertiesResultCache.get(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()))).toBeUndefined();
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties([token], { enableFeeOnTransferFeeFetching: true });
            expect(tokenPropertiesMap[token.address.toLowerCase()]).toBeDefined();
            assertExpectedTokenProperties(tokenPropertiesMap[token.address.toLowerCase()], bignumber_1.BigNumber.from(213), bignumber_1.BigNumber.from(800), src_1.TokenValidationResult.FOT);
            sinon_1.default.assert.calledOnce(mockTokenFeeFetcher.fetchFees);
            const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()));
            expect(cachedTokenProperties).toBeDefined();
            assertExpectedTokenProperties(cachedTokenProperties, bignumber_1.BigNumber.from(213), bignumber_1.BigNumber.from(800), src_1.TokenValidationResult.FOT);
            sinon_1.default.assert.calledOnce(mockTokenFeeFetcher.fetchFees);
            underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()));
            expect(Math.floor(((_a = underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()))) !== null && _a !== void 0 ? _a : 0) / 1000)).toEqual(currentEpochTimeInSeconds + src_1.POSITIVE_CACHE_ENTRY_TTL);
        });
        it('succeeds to get token allowlist with no on-chain calls nor caching', async function () {
            var _a;
            const underlyingCache = new node_cache_1.default({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new src_1.NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(sdk_core_1.ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const allowListToken = new sdk_core_1.Token(1, '0x777E2ae845272a2F540ebf6a3D03734A5a8f618e', 18);
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties([allowListToken], { enableFeeOnTransferFeeFetching: true });
            expect(tokenPropertiesMap[allowListToken.address.toLowerCase()]).toBeDefined();
            expect((_a = tokenPropertiesMap[allowListToken.address.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.tokenFeeResult).toBeUndefined();
            assertExpectedTokenProperties(tokenPropertiesMap[allowListToken.address.toLowerCase()], undefined, undefined, src_1.TokenValidationResult.UNKN);
            expect(await tokenPropertiesResultCache.get(CACHE_KEY(sdk_core_1.ChainId.MAINNET, allowListToken.address.toLowerCase()))).toBeUndefined();
        });
        it('succeeds to get token properties in a single batch', async function () {
            var _a, _b, _c, _d, _e, _f;
            const underlyingCache = new node_cache_1.default({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new src_1.NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(sdk_core_1.ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            const token1 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000012', 18);
            const token2 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000034', 18);
            const token3 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000056', 18);
            const tokens = [token1, token2, token3];
            mockTokenFeeFetcher.fetchFees.callsFake(async (addresses) => {
                const tokenToResult = {};
                addresses.forEach((address) => {
                    tokenToResult[address] = {
                        buyFeeBps: bignumber_1.BigNumber.from(parseInt(address[address.length - 2])),
                        sellFeeBps: bignumber_1.BigNumber.from(parseInt(address[address.length - 1]))
                    };
                });
                return tokenToResult;
            });
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties(tokens, { enableFeeOnTransferFeeFetching: true });
            for (const token of tokens) {
                const address = token.address.toLowerCase();
                expect(tokenPropertiesMap[address]).toBeDefined();
                expect((_a = tokenPropertiesMap[address]) === null || _a === void 0 ? void 0 : _a.tokenFeeResult).toBeDefined();
                const expectedBuyFeeBps = (_c = (_b = tokenPropertiesMap[address]) === null || _b === void 0 ? void 0 : _b.tokenFeeResult) === null || _c === void 0 ? void 0 : _c.buyFeeBps;
                const expectedSellFeeBps = (_e = (_d = tokenPropertiesMap[address]) === null || _d === void 0 ? void 0 : _d.tokenFeeResult) === null || _e === void 0 ? void 0 : _e.sellFeeBps;
                assertExpectedTokenProperties(tokenPropertiesMap[address], expectedBuyFeeBps, expectedSellFeeBps, src_1.TokenValidationResult.FOT);
                const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()));
                expect(cachedTokenProperties).toBeDefined();
                assertExpectedTokenProperties(cachedTokenProperties, expectedBuyFeeBps, expectedSellFeeBps, src_1.TokenValidationResult.FOT);
                underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()));
                expect(Math.floor(((_f = underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()))) !== null && _f !== void 0 ? _f : 0) / 1000)).toEqual(currentEpochTimeInSeconds + src_1.POSITIVE_CACHE_ENTRY_TTL);
            }
        });
        it('all token fee fetch failed', async function () {
            var _a, _b, _c;
            const underlyingCache = new node_cache_1.default({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new src_1.NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(sdk_core_1.ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            const token1 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000012', 18);
            const token2 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000034', 18);
            const token3 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000056', 18);
            const tokens = [token1, token2, token3];
            mockTokenFeeFetcher.fetchFees.withArgs(tokens.map(token => token.address)).throws(new Error('Failed to fetch fees for token 1'));
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties(tokens, { enableFeeOnTransferFeeFetching: true });
            for (const token of tokens) {
                const address = token.address.toLowerCase();
                expect(tokenPropertiesMap[address]).toBeDefined();
                expect((_a = tokenPropertiesMap[address]) === null || _a === void 0 ? void 0 : _a.tokenFeeResult).toBeUndefined();
                expect((_b = tokenPropertiesMap[address]) === null || _b === void 0 ? void 0 : _b.tokenValidationResult).toBeUndefined();
                const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()));
                expect(cachedTokenProperties).toBeDefined();
                expect(cachedTokenProperties === null || cachedTokenProperties === void 0 ? void 0 : cachedTokenProperties.tokenFeeResult).toBeUndefined();
                expect(cachedTokenProperties === null || cachedTokenProperties === void 0 ? void 0 : cachedTokenProperties.tokenValidationResult).toBeUndefined();
                underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()));
                expect(Math.floor(((_c = underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, token.address.toLowerCase()))) !== null && _c !== void 0 ? _c : 0) / 1000)).toEqual(currentEpochTimeInSeconds + src_1.NEGATIVE_CACHE_ENTRY_TTL);
            }
        });
        it('real ETH and BITBOY token fee fetch, only BITBOY fetched', async function () {
            var _a, _b, _c, _d, _e, _f;
            const chain = sdk_core_1.ChainId.MAINNET;
            const chainProvider = (0, src_1.ID_TO_PROVIDER)(chain);
            const provider = new providers_1.JsonRpcProvider(chainProvider, chain);
            const tokenFeeFetcher = new token_fee_fetcher_1.OnChainTokenFeeFetcher(chain, provider);
            const underlyingCache = new node_cache_1.default({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new src_1.NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(sdk_core_1.ChainId.MAINNET, tokenPropertiesResultCache, tokenFeeFetcher);
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            const tokens = [sdk_core_1.WETH9[sdk_core_1.ChainId.MAINNET], mock_data_1.BITBOY];
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties(tokens, { enableFeeOnTransferFeeFetching: true });
            expect(tokenPropertiesMap[sdk_core_1.WETH9[sdk_core_1.ChainId.MAINNET].address.toLowerCase()]).toBeDefined();
            expect((_a = tokenPropertiesMap[sdk_core_1.WETH9[sdk_core_1.ChainId.MAINNET].address.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.tokenFeeResult).toBeUndefined();
            expect((_b = tokenPropertiesMap[sdk_core_1.WETH9[sdk_core_1.ChainId.MAINNET].address.toLowerCase()]) === null || _b === void 0 ? void 0 : _b.tokenValidationResult).toBeUndefined();
            expect(tokenPropertiesMap[mock_data_1.BITBOY.address.toLowerCase()]).toBeDefined();
            expect((_c = tokenPropertiesMap[mock_data_1.BITBOY.address.toLowerCase()]) === null || _c === void 0 ? void 0 : _c.tokenFeeResult).toBeDefined();
            expect((_d = tokenPropertiesMap[mock_data_1.BITBOY.address.toLowerCase()]) === null || _d === void 0 ? void 0 : _d.tokenValidationResult).toBeDefined();
            assertExpectedTokenProperties(tokenPropertiesMap[mock_data_1.BITBOY.address.toLowerCase()], mock_data_1.BITBOY === null || mock_data_1.BITBOY === void 0 ? void 0 : mock_data_1.BITBOY.buyFeeBps, mock_data_1.BITBOY === null || mock_data_1.BITBOY === void 0 ? void 0 : mock_data_1.BITBOY.sellFeeBps, src_1.TokenValidationResult.FOT);
            const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(sdk_core_1.ChainId.MAINNET, mock_data_1.BITBOY.address.toLowerCase()));
            expect(cachedTokenProperties).toBeDefined();
            assertExpectedTokenProperties(cachedTokenProperties, mock_data_1.BITBOY === null || mock_data_1.BITBOY === void 0 ? void 0 : mock_data_1.BITBOY.buyFeeBps, mock_data_1.BITBOY === null || mock_data_1.BITBOY === void 0 ? void 0 : mock_data_1.BITBOY.sellFeeBps, src_1.TokenValidationResult.FOT);
            underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, mock_data_1.BITBOY.address.toLowerCase()));
            const ttlUpperBoundBuffer = 1; // in seconds
            expect(Math.floor(((_e = underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, mock_data_1.BITBOY.address.toLowerCase()))) !== null && _e !== void 0 ? _e : 0) / 1000)).toBeGreaterThanOrEqual(currentEpochTimeInSeconds + src_1.POSITIVE_CACHE_ENTRY_TTL);
            expect(Math.floor(((_f = underlyingCache.getTtl(CACHE_KEY(sdk_core_1.ChainId.MAINNET, mock_data_1.BITBOY.address.toLowerCase()))) !== null && _f !== void 0 ? _f : 0) / 1000)).toBeLessThanOrEqual(currentEpochTimeInSeconds + src_1.POSITIVE_CACHE_ENTRY_TTL + ttlUpperBoundBuffer);
        });
    });
    function assertExpectedTokenProperties(tokenProperties, expectedBuyFeeBps, expectedSellFeeBps, expectedTokenValidationResult) {
        var _a, _b, _c, _d, _e, _f;
        if (expectedBuyFeeBps) {
            expect((_b = (_a = tokenProperties === null || tokenProperties === void 0 ? void 0 : tokenProperties.tokenFeeResult) === null || _a === void 0 ? void 0 : _a.buyFeeBps) === null || _b === void 0 ? void 0 : _b.eq(expectedBuyFeeBps)).toBeTruthy();
        }
        else {
            expect((_c = tokenProperties === null || tokenProperties === void 0 ? void 0 : tokenProperties.tokenFeeResult) === null || _c === void 0 ? void 0 : _c.buyFeeBps).toBeUndefined();
        }
        if (expectedSellFeeBps) {
            expect((_e = (_d = tokenProperties === null || tokenProperties === void 0 ? void 0 : tokenProperties.tokenFeeResult) === null || _d === void 0 ? void 0 : _d.sellFeeBps) === null || _e === void 0 ? void 0 : _e.eq(expectedSellFeeBps)).toBeTruthy();
        }
        else {
            expect((_f = tokenProperties === null || tokenProperties === void 0 ? void 0 : tokenProperties.tokenFeeResult) === null || _f === void 0 ? void 0 : _f.sellFeeBps).toBeUndefined();
        }
        expect(tokenProperties === null || tokenProperties === void 0 ? void 0 : tokenProperties.tokenValidationResult).toEqual(expectedTokenValidationResult);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW4tcHJvcGVydGllcy1wcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy90b2tlbi1wcm9wZXJ0aWVzLXByb3ZpZGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnREFBMEQ7QUFDMUQsNERBQW1DO0FBQ25DLGtEQUEwQjtBQUMxQixnRkFJa0Q7QUFDbEQsd0RBQXFEO0FBQ3JELHNDQVFzQjtBQUN0QixvREFBNEI7QUFDNUIsd0RBQTJEO0FBQzNELHlEQUFtRDtBQUVuRCxnQkFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBRWhCLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxHQUFHLEVBQUU7SUFDdkMsSUFBSSxtQkFBaUUsQ0FBQTtJQUVyRSxNQUFNLFNBQVMsR0FBRyxDQUFDLE9BQWdCLEVBQUUsT0FBZSxFQUFFLEVBQUUsQ0FDdEQsb0JBQW9CLE9BQU8sSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUUzQyxVQUFVLENBQUMsS0FBSyxJQUFJLEVBQUU7UUFDcEIsbUJBQW1CLEdBQUcsZUFBSyxDQUFDLGtCQUFrQixDQUFDLDBDQUFzQixDQUFDLENBQUE7UUFFdEUsbUJBQW1CLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDMUQsTUFBTSxhQUFhLEdBQWdCLEVBQUUsQ0FBQztZQUN0QyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUc7Z0JBQ3RELFNBQVMsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7Z0JBQzlCLFVBQVUsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7YUFDaEMsQ0FBQyxDQUFBO1lBRUYsT0FBTyxhQUFhLENBQUE7UUFDdEIsQ0FBQyxDQUFDLENBQUE7SUFDSixDQUFDLENBQUMsQ0FBQTtJQUVGLFFBQVEsQ0FBQywyQkFBMkIsRUFBRSxHQUFHLEVBQUU7UUFDekMsRUFBRSxDQUFDLDZDQUE2QyxFQUFFLEtBQUssSUFBSSxFQUFFOztZQUMzRCxNQUFNLGVBQWUsR0FBYyxJQUFJLG9CQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFBO1lBQ3BGLE1BQU0sMEJBQTBCLEdBQXVDLElBQUksaUJBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUN4RyxNQUFNLHVCQUF1QixHQUFHLElBQUksNkJBQXVCLENBQ3pELGtCQUFPLENBQUMsT0FBTyxFQUNmLDBCQUEwQixFQUMxQixtQkFBbUIsQ0FDcEIsQ0FBQTtZQUVELE1BQU0sS0FBSyxHQUFHLGtCQUFZLENBQUE7WUFDMUIsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUVoRSxNQUFNLENBQUMsTUFBTSwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGtCQUFPLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDdEgsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLHVCQUF1QixDQUFDLG1CQUFtQixDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSw4QkFBOEIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ2hJLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN0RSw2QkFBNkIsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUscUJBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUscUJBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsMkJBQXFCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFcEosTUFBTSxxQkFBcUIsR0FBRyxNQUFNLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUE7WUFDM0gsTUFBTSxDQUFDLHFCQUFxQixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDNUMsNkJBQTZCLENBQUMscUJBQXFCLEVBQUUscUJBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUscUJBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsMkJBQXFCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFMUgsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUE7WUFDL0UsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFBLGVBQWUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGtCQUFPLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyx5QkFBeUIsR0FBRyw4QkFBd0IsQ0FBQyxDQUFDO1FBQ2xMLENBQUMsQ0FBQyxDQUFBO1FBRUYsRUFBRSxDQUFDLGtGQUFrRixFQUFFLEtBQUs7O1lBQzFGLE1BQU0sZUFBZSxHQUFjLElBQUksb0JBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUE7WUFDcEYsTUFBTSwwQkFBMEIsR0FBdUMsSUFBSSxpQkFBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3hHLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSw2QkFBdUIsQ0FDekQsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsMEJBQTBCLEVBQzFCLG1CQUFtQixDQUNwQixDQUFBO1lBRUQsTUFBTSxLQUFLLEdBQUcsa0JBQVksQ0FBQTtZQUMxQixNQUFNLHlCQUF5QixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO1lBRWhFLE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN0SCxNQUFNLGtCQUFrQixHQUFHLE1BQU0sdUJBQXVCLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLDhCQUE4QixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDaEksTUFBTSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3RFLDZCQUE2QixDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSwyQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNwSixlQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQTtZQUV0RCxNQUFNLHFCQUFxQixHQUFHLE1BQU0sMEJBQTBCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQTtZQUMzSCxNQUFNLENBQUMscUJBQXFCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUM1Qyw2QkFBNkIsQ0FBQyxxQkFBcUIsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSwyQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMxSCxlQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQTtZQUV0RCxlQUFlLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQTtZQUMvRSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQUEsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLG1DQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLHlCQUF5QixHQUFHLDhCQUF3QixDQUFDLENBQUM7UUFDbEwsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsb0VBQW9FLEVBQUUsS0FBSzs7WUFDNUUsTUFBTSxlQUFlLEdBQWMsSUFBSSxvQkFBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQTtZQUNwRixNQUFNLDBCQUEwQixHQUF1QyxJQUFJLGlCQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDeEcsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLDZCQUF1QixDQUN6RCxrQkFBTyxDQUFDLE9BQU8sRUFDZiwwQkFBMEIsRUFDMUIsbUJBQW1CLENBQ3BCLENBQUE7WUFFRCxNQUFNLGNBQWMsR0FBRyxJQUFJLGdCQUFLLENBQUMsQ0FBQyxFQUFFLDRDQUE0QyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3RGLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxFQUFFLEVBQUUsOEJBQThCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUV6SSxNQUFNLENBQUMsa0JBQWtCLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDL0UsTUFBTSxDQUFDLE1BQUEsa0JBQWtCLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQywwQ0FBRSxjQUFjLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNqRyw2QkFBNkIsQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSwyQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUUxSSxNQUFNLENBQUMsTUFBTSwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGtCQUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDakksQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsb0RBQW9ELEVBQUUsS0FBSzs7WUFDNUQsTUFBTSxlQUFlLEdBQWMsSUFBSSxvQkFBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQTtZQUNwRixNQUFNLDBCQUEwQixHQUF1QyxJQUFJLGlCQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDeEcsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLDZCQUF1QixDQUN6RCxrQkFBTyxDQUFDLE9BQU8sRUFDZiwwQkFBMEIsRUFDMUIsbUJBQW1CLENBQ3BCLENBQUE7WUFDRCxNQUFNLHlCQUF5QixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO1lBRWhFLE1BQU0sTUFBTSxHQUFHLElBQUksZ0JBQUssQ0FBQyxDQUFDLEVBQUUsNENBQTRDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDOUUsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQkFBSyxDQUFDLENBQUMsRUFBRSw0Q0FBNEMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM5RSxNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFLLENBQUMsQ0FBQyxFQUFFLDRDQUE0QyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sTUFBTSxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQTtZQUV2QyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsRUFBRTtnQkFDMUQsTUFBTSxhQUFhLEdBQWdCLEVBQUUsQ0FBQztnQkFDdEMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO29CQUM1QixhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUc7d0JBQ3ZCLFNBQVMsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFFLENBQUMsQ0FBQzt3QkFDakUsVUFBVSxFQUFFLHFCQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUUsQ0FBQyxDQUFDO3FCQUNuRSxDQUFBO2dCQUNILENBQUMsQ0FBQyxDQUFDO2dCQUVILE9BQU8sYUFBYSxDQUFBO1lBQ3RCLENBQUMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLHVCQUF1QixDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxFQUFFLDhCQUE4QixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFFL0gsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUU7Z0JBQzFCLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUE7Z0JBQzNDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUNsRCxNQUFNLENBQUMsTUFBQSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsMENBQUUsY0FBYyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2xFLE1BQU0saUJBQWlCLEdBQUcsTUFBQSxNQUFBLGtCQUFrQixDQUFDLE9BQU8sQ0FBQywwQ0FBRSxjQUFjLDBDQUFFLFNBQVMsQ0FBQTtnQkFDaEYsTUFBTSxrQkFBa0IsR0FBRyxNQUFBLE1BQUEsa0JBQWtCLENBQUMsT0FBTyxDQUFDLDBDQUFFLGNBQWMsMENBQUUsVUFBVSxDQUFBO2dCQUNsRiw2QkFBNkIsQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSwyQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFFN0gsTUFBTSxxQkFBcUIsR0FBRyxNQUFNLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUE7Z0JBQzNILE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUM1Qyw2QkFBNkIsQ0FBQyxxQkFBcUIsRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSwyQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFFdkgsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUE7Z0JBQy9FLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBQSxlQUFlLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsbUNBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMseUJBQXlCLEdBQUcsOEJBQXdCLENBQUMsQ0FBQzthQUNqTDtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLDRCQUE0QixFQUFFLEtBQUs7O1lBQ3BDLE1BQU0sZUFBZSxHQUFjLElBQUksb0JBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUE7WUFDcEYsTUFBTSwwQkFBMEIsR0FBdUMsSUFBSSxpQkFBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3hHLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSw2QkFBdUIsQ0FDekQsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsMEJBQTBCLEVBQzFCLG1CQUFtQixDQUNwQixDQUFBO1lBQ0QsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUVoRSxNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFLLENBQUMsQ0FBQyxFQUFFLDRDQUE0QyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlFLE1BQU0sTUFBTSxHQUFHLElBQUksZ0JBQUssQ0FBQyxDQUFDLEVBQUUsNENBQTRDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDOUUsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQkFBSyxDQUFDLENBQUMsRUFBRSw0Q0FBNEMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUU5RSxNQUFNLE1BQU0sR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUE7WUFFdkMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLGtDQUFrQyxDQUFDLENBQUMsQ0FBQztZQUVqSSxNQUFNLGtCQUFrQixHQUFHLE1BQU0sdUJBQXVCLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLEVBQUUsOEJBQThCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUUvSCxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtnQkFDMUIsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQTtnQkFDM0MsTUFBTSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2xELE1BQU0sQ0FBQyxNQUFBLGtCQUFrQixDQUFDLE9BQU8sQ0FBQywwQ0FBRSxjQUFjLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDcEUsTUFBTSxDQUFDLE1BQUEsa0JBQWtCLENBQUMsT0FBTyxDQUFDLDBDQUFFLHFCQUFxQixDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7Z0JBRTNFLE1BQU0scUJBQXFCLEdBQUcsTUFBTSwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGtCQUFPLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFBO2dCQUMzSCxNQUFNLENBQUMscUJBQXFCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDNUMsTUFBTSxDQUFDLHFCQUFxQixhQUFyQixxQkFBcUIsdUJBQXJCLHFCQUFxQixDQUFFLGNBQWMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUM5RCxNQUFNLENBQUMscUJBQXFCLGFBQXJCLHFCQUFxQix1QkFBckIscUJBQXFCLENBQUUscUJBQXFCLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFFckUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUE7Z0JBQy9FLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBQSxlQUFlLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsbUNBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMseUJBQXlCLEdBQUcsOEJBQXdCLENBQUMsQ0FBQzthQUNqTDtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLDBEQUEwRCxFQUFFLEtBQUs7O1lBQ2xFLE1BQU0sS0FBSyxHQUFHLGtCQUFPLENBQUMsT0FBTyxDQUFDO1lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUEsb0JBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQztZQUM1QyxNQUFNLFFBQVEsR0FBRyxJQUFJLDJCQUFlLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzNELE1BQU0sZUFBZSxHQUFHLElBQUksMENBQXNCLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBRXBFLE1BQU0sZUFBZSxHQUFjLElBQUksb0JBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUE7WUFDcEYsTUFBTSwwQkFBMEIsR0FBdUMsSUFBSSxpQkFBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3hHLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSw2QkFBdUIsQ0FDekQsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsMEJBQTBCLEVBQzFCLGVBQWUsQ0FDaEIsQ0FBQTtZQUNELE1BQU0seUJBQXlCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFFaEUsTUFBTSxNQUFNLEdBQUcsQ0FBQyxnQkFBSyxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFFLEVBQUUsa0JBQU0sQ0FBQyxDQUFBO1lBRWhELE1BQU0sa0JBQWtCLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSw4QkFBOEIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBRS9ILE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBSyxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFFLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQTtZQUN2RixNQUFNLENBQUMsTUFBQSxrQkFBa0IsQ0FBQyxnQkFBSyxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFFLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLDBDQUFFLGNBQWMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFBO1lBQ3pHLE1BQU0sQ0FBQyxNQUFBLGtCQUFrQixDQUFDLGdCQUFLLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUUsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsMENBQUUscUJBQXFCLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQTtZQUVoSCxNQUFNLENBQUMsa0JBQWtCLENBQUMsa0JBQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3ZFLE1BQU0sQ0FBQyxNQUFBLGtCQUFrQixDQUFDLGtCQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLDBDQUFFLGNBQWMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3ZGLE1BQU0sQ0FBQyxNQUFBLGtCQUFrQixDQUFDLGtCQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLDBDQUFFLHFCQUFxQixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDOUYsNkJBQTZCLENBQUMsa0JBQWtCLENBQUMsa0JBQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsRUFDNUUsa0JBQU0sYUFBTixrQkFBTSx1QkFBTixrQkFBTSxDQUFFLFNBQVMsRUFDakIsa0JBQU0sYUFBTixrQkFBTSx1QkFBTixrQkFBTSxDQUFFLFVBQVUsRUFDbEIsMkJBQXFCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFN0IsTUFBTSxxQkFBcUIsR0FBRyxNQUFNLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFBO1lBQzVILE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzVDLDZCQUE2QixDQUFDLHFCQUFxQixFQUFFLGtCQUFNLGFBQU4sa0JBQU0sdUJBQU4sa0JBQU0sQ0FBRSxTQUFTLEVBQUUsa0JBQU0sYUFBTixrQkFBTSx1QkFBTixrQkFBTSxDQUFFLFVBQVUsRUFBRSwyQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUV2SCxlQUFlLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxrQkFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUE7WUFFaEYsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLENBQUEsQ0FBQyxhQUFhO1lBQzNDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBQSxlQUFlLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxrQkFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLG1DQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMseUJBQXlCLEdBQUcsOEJBQXdCLENBQUMsQ0FBQztZQUNoTSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQUEsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsa0JBQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLHlCQUF5QixHQUFHLDhCQUF3QixHQUFHLG1CQUFtQixDQUFDLENBQUM7UUFDck4sQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILFNBQVMsNkJBQTZCLENBQ3BDLGVBQXVDLEVBQ3ZDLGlCQUE2QixFQUM3QixrQkFBOEIsRUFDOUIsNkJBQXFEOztRQUVyRCxJQUFJLGlCQUFpQixFQUFFO1lBQ3JCLE1BQU0sQ0FBQyxNQUFBLE1BQUEsZUFBZSxhQUFmLGVBQWUsdUJBQWYsZUFBZSxDQUFFLGNBQWMsMENBQUUsU0FBUywwQ0FBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1NBQ3hGO2FBQU07WUFDTCxNQUFNLENBQUMsTUFBQSxlQUFlLGFBQWYsZUFBZSx1QkFBZixlQUFlLENBQUUsY0FBYywwQ0FBRSxTQUFTLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztTQUNwRTtRQUVELElBQUksa0JBQWtCLEVBQUU7WUFDdEIsTUFBTSxDQUFDLE1BQUEsTUFBQSxlQUFlLGFBQWYsZUFBZSx1QkFBZixlQUFlLENBQUUsY0FBYywwQ0FBRSxVQUFVLDBDQUFFLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7U0FDMUY7YUFBTTtZQUNMLE1BQU0sQ0FBQyxNQUFBLGVBQWUsYUFBZixlQUFlLHVCQUFmLGVBQWUsQ0FBRSxjQUFjLDBDQUFFLFVBQVUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO1NBQ3JFO1FBRUQsTUFBTSxDQUFDLGVBQWUsYUFBZixlQUFlLHVCQUFmLGVBQWUsQ0FBRSxxQkFBcUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7QUFDSCxDQUFDLENBQUMsQ0FBQyJ9
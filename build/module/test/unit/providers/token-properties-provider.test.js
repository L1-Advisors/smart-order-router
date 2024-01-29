import { ChainId, Token, WETH9 } from '@uniswap/sdk-core';
import NodeCache from 'node-cache';
import sinon from 'sinon';
import { OnChainTokenFeeFetcher } from '../../../src/providers/token-fee-fetcher';
import { BigNumber } from '@ethersproject/bignumber';
import { NodeJSCache, POSITIVE_CACHE_ENTRY_TTL, NEGATIVE_CACHE_ENTRY_TTL, TokenPropertiesProvider, TokenValidationResult, USDC_MAINNET, ID_TO_PROVIDER } from '../../../src';
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { BITBOY } from '../../test-util/mock-data';
dotenv.config();
describe('TokenPropertiesProvider', () => {
    let mockTokenFeeFetcher;
    const CACHE_KEY = (chainId, address) => `token-properties-${chainId}-${address}`;
    beforeEach(async () => {
        mockTokenFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher);
        mockTokenFeeFetcher.fetchFees.callsFake(async (addresses) => {
            const tokenToResult = {};
            addresses.forEach((address) => tokenToResult[address] = {
                buyFeeBps: BigNumber.from(213),
                sellFeeBps: BigNumber.from(800)
            });
            return tokenToResult;
        });
    });
    describe('get token fees by address', () => {
        it('succeeds to get token fee and updates cache', async () => {
            var _a;
            const underlyingCache = new NodeCache({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new TokenPropertiesProvider(ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const token = USDC_MAINNET;
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            expect(await tokenPropertiesResultCache.get(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()))).toBeUndefined();
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties([token], { enableFeeOnTransferFeeFetching: true });
            expect(tokenPropertiesMap[token.address.toLowerCase()]).toBeDefined();
            assertExpectedTokenProperties(tokenPropertiesMap[token.address.toLowerCase()], BigNumber.from(213), BigNumber.from(800), TokenValidationResult.FOT);
            const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()));
            expect(cachedTokenProperties).toBeDefined();
            assertExpectedTokenProperties(cachedTokenProperties, BigNumber.from(213), BigNumber.from(800), TokenValidationResult.FOT);
            underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()));
            expect(Math.floor(((_a = underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()))) !== null && _a !== void 0 ? _a : 0) / 1000)).toEqual(currentEpochTimeInSeconds + POSITIVE_CACHE_ENTRY_TTL);
        });
        it('succeeds to get token fee cache hit and second token fee fetcher call is skipped', async function () {
            var _a;
            const underlyingCache = new NodeCache({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new TokenPropertiesProvider(ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const token = USDC_MAINNET;
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            expect(await tokenPropertiesResultCache.get(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()))).toBeUndefined();
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties([token], { enableFeeOnTransferFeeFetching: true });
            expect(tokenPropertiesMap[token.address.toLowerCase()]).toBeDefined();
            assertExpectedTokenProperties(tokenPropertiesMap[token.address.toLowerCase()], BigNumber.from(213), BigNumber.from(800), TokenValidationResult.FOT);
            sinon.assert.calledOnce(mockTokenFeeFetcher.fetchFees);
            const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()));
            expect(cachedTokenProperties).toBeDefined();
            assertExpectedTokenProperties(cachedTokenProperties, BigNumber.from(213), BigNumber.from(800), TokenValidationResult.FOT);
            sinon.assert.calledOnce(mockTokenFeeFetcher.fetchFees);
            underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()));
            expect(Math.floor(((_a = underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()))) !== null && _a !== void 0 ? _a : 0) / 1000)).toEqual(currentEpochTimeInSeconds + POSITIVE_CACHE_ENTRY_TTL);
        });
        it('succeeds to get token allowlist with no on-chain calls nor caching', async function () {
            var _a;
            const underlyingCache = new NodeCache({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new TokenPropertiesProvider(ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const allowListToken = new Token(1, '0x777E2ae845272a2F540ebf6a3D03734A5a8f618e', 18);
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties([allowListToken], { enableFeeOnTransferFeeFetching: true });
            expect(tokenPropertiesMap[allowListToken.address.toLowerCase()]).toBeDefined();
            expect((_a = tokenPropertiesMap[allowListToken.address.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.tokenFeeResult).toBeUndefined();
            assertExpectedTokenProperties(tokenPropertiesMap[allowListToken.address.toLowerCase()], undefined, undefined, TokenValidationResult.UNKN);
            expect(await tokenPropertiesResultCache.get(CACHE_KEY(ChainId.MAINNET, allowListToken.address.toLowerCase()))).toBeUndefined();
        });
        it('succeeds to get token properties in a single batch', async function () {
            var _a, _b, _c, _d, _e, _f;
            const underlyingCache = new NodeCache({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new TokenPropertiesProvider(ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            const token1 = new Token(1, '0x0000000000000000000000000000000000000012', 18);
            const token2 = new Token(1, '0x0000000000000000000000000000000000000034', 18);
            const token3 = new Token(1, '0x0000000000000000000000000000000000000056', 18);
            const tokens = [token1, token2, token3];
            mockTokenFeeFetcher.fetchFees.callsFake(async (addresses) => {
                const tokenToResult = {};
                addresses.forEach((address) => {
                    tokenToResult[address] = {
                        buyFeeBps: BigNumber.from(parseInt(address[address.length - 2])),
                        sellFeeBps: BigNumber.from(parseInt(address[address.length - 1]))
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
                assertExpectedTokenProperties(tokenPropertiesMap[address], expectedBuyFeeBps, expectedSellFeeBps, TokenValidationResult.FOT);
                const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()));
                expect(cachedTokenProperties).toBeDefined();
                assertExpectedTokenProperties(cachedTokenProperties, expectedBuyFeeBps, expectedSellFeeBps, TokenValidationResult.FOT);
                underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()));
                expect(Math.floor(((_f = underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()))) !== null && _f !== void 0 ? _f : 0) / 1000)).toEqual(currentEpochTimeInSeconds + POSITIVE_CACHE_ENTRY_TTL);
            }
        });
        it('all token fee fetch failed', async function () {
            var _a, _b, _c;
            const underlyingCache = new NodeCache({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new TokenPropertiesProvider(ChainId.MAINNET, tokenPropertiesResultCache, mockTokenFeeFetcher);
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            const token1 = new Token(1, '0x0000000000000000000000000000000000000012', 18);
            const token2 = new Token(1, '0x0000000000000000000000000000000000000034', 18);
            const token3 = new Token(1, '0x0000000000000000000000000000000000000056', 18);
            const tokens = [token1, token2, token3];
            mockTokenFeeFetcher.fetchFees.withArgs(tokens.map(token => token.address)).throws(new Error('Failed to fetch fees for token 1'));
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties(tokens, { enableFeeOnTransferFeeFetching: true });
            for (const token of tokens) {
                const address = token.address.toLowerCase();
                expect(tokenPropertiesMap[address]).toBeDefined();
                expect((_a = tokenPropertiesMap[address]) === null || _a === void 0 ? void 0 : _a.tokenFeeResult).toBeUndefined();
                expect((_b = tokenPropertiesMap[address]) === null || _b === void 0 ? void 0 : _b.tokenValidationResult).toBeUndefined();
                const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()));
                expect(cachedTokenProperties).toBeDefined();
                expect(cachedTokenProperties === null || cachedTokenProperties === void 0 ? void 0 : cachedTokenProperties.tokenFeeResult).toBeUndefined();
                expect(cachedTokenProperties === null || cachedTokenProperties === void 0 ? void 0 : cachedTokenProperties.tokenValidationResult).toBeUndefined();
                underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()));
                expect(Math.floor(((_c = underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, token.address.toLowerCase()))) !== null && _c !== void 0 ? _c : 0) / 1000)).toEqual(currentEpochTimeInSeconds + NEGATIVE_CACHE_ENTRY_TTL);
            }
        });
        it('real ETH and BITBOY token fee fetch, only BITBOY fetched', async function () {
            var _a, _b, _c, _d, _e, _f;
            const chain = ChainId.MAINNET;
            const chainProvider = ID_TO_PROVIDER(chain);
            const provider = new JsonRpcProvider(chainProvider, chain);
            const tokenFeeFetcher = new OnChainTokenFeeFetcher(chain, provider);
            const underlyingCache = new NodeCache({ stdTTL: 3600, useClones: false });
            const tokenPropertiesResultCache = new NodeJSCache(underlyingCache);
            const tokenPropertiesProvider = new TokenPropertiesProvider(ChainId.MAINNET, tokenPropertiesResultCache, tokenFeeFetcher);
            const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
            const tokens = [WETH9[ChainId.MAINNET], BITBOY];
            const tokenPropertiesMap = await tokenPropertiesProvider.getTokensProperties(tokens, { enableFeeOnTransferFeeFetching: true });
            expect(tokenPropertiesMap[WETH9[ChainId.MAINNET].address.toLowerCase()]).toBeDefined();
            expect((_a = tokenPropertiesMap[WETH9[ChainId.MAINNET].address.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.tokenFeeResult).toBeUndefined();
            expect((_b = tokenPropertiesMap[WETH9[ChainId.MAINNET].address.toLowerCase()]) === null || _b === void 0 ? void 0 : _b.tokenValidationResult).toBeUndefined();
            expect(tokenPropertiesMap[BITBOY.address.toLowerCase()]).toBeDefined();
            expect((_c = tokenPropertiesMap[BITBOY.address.toLowerCase()]) === null || _c === void 0 ? void 0 : _c.tokenFeeResult).toBeDefined();
            expect((_d = tokenPropertiesMap[BITBOY.address.toLowerCase()]) === null || _d === void 0 ? void 0 : _d.tokenValidationResult).toBeDefined();
            assertExpectedTokenProperties(tokenPropertiesMap[BITBOY.address.toLowerCase()], BITBOY === null || BITBOY === void 0 ? void 0 : BITBOY.buyFeeBps, BITBOY === null || BITBOY === void 0 ? void 0 : BITBOY.sellFeeBps, TokenValidationResult.FOT);
            const cachedTokenProperties = await tokenPropertiesResultCache.get(CACHE_KEY(ChainId.MAINNET, BITBOY.address.toLowerCase()));
            expect(cachedTokenProperties).toBeDefined();
            assertExpectedTokenProperties(cachedTokenProperties, BITBOY === null || BITBOY === void 0 ? void 0 : BITBOY.buyFeeBps, BITBOY === null || BITBOY === void 0 ? void 0 : BITBOY.sellFeeBps, TokenValidationResult.FOT);
            underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, BITBOY.address.toLowerCase()));
            const ttlUpperBoundBuffer = 1; // in seconds
            expect(Math.floor(((_e = underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, BITBOY.address.toLowerCase()))) !== null && _e !== void 0 ? _e : 0) / 1000)).toBeGreaterThanOrEqual(currentEpochTimeInSeconds + POSITIVE_CACHE_ENTRY_TTL);
            expect(Math.floor(((_f = underlyingCache.getTtl(CACHE_KEY(ChainId.MAINNET, BITBOY.address.toLowerCase()))) !== null && _f !== void 0 ? _f : 0) / 1000)).toBeLessThanOrEqual(currentEpochTimeInSeconds + POSITIVE_CACHE_ENTRY_TTL + ttlUpperBoundBuffer);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW4tcHJvcGVydGllcy1wcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy90b2tlbi1wcm9wZXJ0aWVzLXByb3ZpZGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDMUQsT0FBTyxTQUFTLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUMxQixPQUFPLEVBRUwsc0JBQXNCLEVBRXZCLE1BQU0sMENBQTBDLENBQUM7QUFDbEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFDTCxXQUFXLEVBQ1gsd0JBQXdCLEVBQ3hCLHdCQUF3QixFQUN4Qix1QkFBdUIsRUFFdkIscUJBQXFCLEVBQ3JCLFlBQVksRUFBRSxjQUFjLEVBQzdCLE1BQU0sY0FBYyxDQUFDO0FBQ3RCLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRW5ELE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUVoQixRQUFRLENBQUMseUJBQXlCLEVBQUUsR0FBRyxFQUFFO0lBQ3ZDLElBQUksbUJBQWlFLENBQUE7SUFFckUsTUFBTSxTQUFTLEdBQUcsQ0FBQyxPQUFnQixFQUFFLE9BQWUsRUFBRSxFQUFFLENBQ3RELG9CQUFvQixPQUFPLElBQUksT0FBTyxFQUFFLENBQUM7SUFFM0MsVUFBVSxDQUFDLEtBQUssSUFBSSxFQUFFO1FBQ3BCLG1CQUFtQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFBO1FBRXRFLG1C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
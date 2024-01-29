import sinon from 'sinon';
import { CurrencyAmount, DAI_MAINNET, SimulationStatus, USDC_MAINNET, V3HeuristicGasModelFactory, V3PoolProvider, V3Route, V3RouteWithValidQuote, WRAPPED_NATIVE_CURRENCY, } from '../../../../../src';
import { calculateGasUsed, getHighestLiquidityV3NativePool, getHighestLiquidityV3USDPool, } from '../../../../../src/util/gas-factory-helpers';
import { buildMockV3PoolAccessor, DAI_WETH_MEDIUM, USDC_DAI_LOW, USDC_WETH_HIGH_LIQ_HIGH, USDC_WETH_LOW_LIQ_LOW, USDC_WETH_MED_LIQ_MEDIUM, } from '../../../../test-util/mock-data';
import { BigNumber } from 'ethers';
import { getMockedV2PoolProvider, getMockedV3PoolProvider } from '../gas-models/test-util/mocked-dependencies';
import { TradeType } from '@uniswap/sdk-core';
import { Trade } from '@uniswap/router-sdk';
import { Route } from '@uniswap/v3-sdk';
import { getPools } from '../gas-models/test-util/helpers';
const mockUSDCNativePools = [
    USDC_WETH_LOW_LIQ_LOW,
    USDC_WETH_MED_LIQ_MEDIUM,
    USDC_WETH_HIGH_LIQ_HIGH,
];
const mockGasTokenNativePools = [
    DAI_WETH_MEDIUM
];
describe('gas factory helpers tests', () => {
    const gasPriceWei = BigNumber.from(1000000000); // 1 gwei
    const chainId = 1;
    let mockPoolProvider;
    beforeEach(() => {
        mockPoolProvider = sinon.createStubInstance(V3PoolProvider);
        mockPoolProvider.getPools.resolves(buildMockV3PoolAccessor([
            ...mockUSDCNativePools,
            ...mockGasTokenNativePools,
        ]));
    });
    describe('getHighestLiquidityV3NativePool', () => {
        it('should return the highest native liquidity pool', async () => {
            const nativeAmountPool = await getHighestLiquidityV3NativePool(USDC_MAINNET, mockPoolProvider);
            expect(nativeAmountPool).toStrictEqual(USDC_WETH_HIGH_LIQ_HIGH);
        });
        it('should return null if there are no native pools with the specified token', async () => {
            const mockPoolProvider = sinon.createStubInstance(V3PoolProvider);
            mockPoolProvider.getPools.resolves(buildMockV3PoolAccessor([USDC_DAI_LOW]));
            const nativeAmountPool = await getHighestLiquidityV3NativePool(USDC_MAINNET, mockPoolProvider);
            expect(nativeAmountPool).toBeNull();
        });
    });
    describe('getHighestLiquidityV3USDPool', () => {
        it('should return the highest usd liquidity pool', async () => {
            const usdPool = await getHighestLiquidityV3USDPool(1, mockPoolProvider);
            expect(usdPool).toStrictEqual(USDC_WETH_HIGH_LIQ_HIGH);
        });
        it('should throw error if there are no usd native pools', async () => {
            const mockPoolProvider = sinon.createStubInstance(V3PoolProvider);
            mockPoolProvider.getPools.resolves(buildMockV3PoolAccessor([USDC_DAI_LOW]));
            await expect(getHighestLiquidityV3USDPool(1, mockPoolProvider)).rejects.toThrowError(`Could not find a USD/${WRAPPED_NATIVE_CURRENCY[1].symbol} pool for computing gas costs.`);
        });
    });
    describe('calculateGasUsed', () => {
        it('should return correct estimated gas values and quoteGasAdjusted', async () => {
            const mockPoolProvider = getMockedV3PoolProvider();
            const amountToken = WRAPPED_NATIVE_CURRENCY[1];
            const quoteToken = DAI_MAINNET;
            const gasToken = USDC_MAINNET;
            const providerConfig = {
                gasToken
            };
            const pools = await getPools(amountToken, quoteToken, mockPoolProvider, providerConfig, gasToken);
            const v3GasModel = await (new V3HeuristicGasModelFactory()).buildGasModel({
                chainId: chainId,
                gasPriceWei,
                pools,
                amountToken,
                quoteToken,
                v2poolProvider: getMockedV2PoolProvider(),
                l2GasDataProvider: undefined,
                providerConfig
            });
            const mockSwapRoute = {
                quote: CurrencyAmount.fromRawAmount(quoteToken, 100),
                quoteGasAdjusted: CurrencyAmount.fromRawAmount(quoteToken, 100),
                // these are all 0 before the function is called
                estimatedGasUsed: BigNumber.from(0),
                estimatedGasUsedQuoteToken: CurrencyAmount.fromRawAmount(quoteToken, 0),
                estimatedGasUsedUSD: CurrencyAmount.fromRawAmount(quoteToken, 0),
                estimatedGasUsedGasToken: undefined,
                gasPriceWei,
                trade: new Trade({
                    v3Routes: [{
                            routev3: new Route([DAI_WETH_MEDIUM], amountToken, quoteToken),
                            inputAmount: CurrencyAmount.fromRawAmount(amountToken, 1),
                            outputAmount: CurrencyAmount.fromRawAmount(quoteToken, 100),
                        }],
                    v2Routes: [],
                    mixedRoutes: [],
                    tradeType: TradeType.EXACT_INPUT,
                }),
                route: [new V3RouteWithValidQuote({
                        amount: CurrencyAmount.fromRawAmount(amountToken, 1),
                        rawQuote: BigNumber.from('100'),
                        quoteToken,
                        sqrtPriceX96AfterList: [],
                        initializedTicksCrossedList: [1],
                        quoterGasEstimate: BigNumber.from(100000),
                        percent: 100,
                        route: new V3Route([DAI_WETH_MEDIUM], amountToken, quoteToken),
                        tradeType: TradeType.EXACT_INPUT,
                        v3PoolProvider: mockPoolProvider,
                        gasModel: v3GasModel,
                    })],
                blockNumber: BigNumber.from(123456),
                simulationStatus: SimulationStatus.Succeeded,
                methodParameters: {
                    calldata: '0x0',
                    value: '0x0',
                    to: '0x0',
                },
            };
            const simulatedGasUsed = BigNumber.from(100000);
            const { estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, quoteGasAdjusted } = await calculateGasUsed(chainId, mockSwapRoute, simulatedGasUsed, getMockedV2PoolProvider(), mockPoolProvider, undefined, providerConfig);
            expect(estimatedGasUsedQuoteToken.currency.equals(quoteToken)).toBe(true);
            expect(estimatedGasUsedQuoteToken.toExact()).not.toEqual('0');
            expect(estimatedGasUsedUSD.toExact()).not.toEqual('0');
            expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(gasToken)).toBe(true);
            expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.toExact()).not.toEqual('0');
            expect(quoteGasAdjusted.lessThan(mockSwapRoute.quote)).toBe(true);
            const arbGasData = {
                perL2TxFee: BigNumber.from(1000000),
                perL1CalldataFee: BigNumber.from(1000),
                perArbGasTotal: BigNumber.from(1000000000),
            };
            const { estimatedGasUsedQuoteToken: estimatedGasUsedQuoteTokenArb, estimatedGasUsedUSD: estimatedGasUsedUSDArb, estimatedGasUsedGasToken: estimatedGasUsedGasTokenArb, quoteGasAdjusted: quoteGasAdjustedArb } = await calculateGasUsed(chainId, mockSwapRoute, simulatedGasUsed, getMockedV2PoolProvider(), mockPoolProvider, arbGasData, providerConfig);
            // Arbitrum gas data should not affect the quote gas or USD amounts
            expect(estimatedGasUsedQuoteTokenArb.currency.equals(quoteToken)).toBe(true);
            expect(estimatedGasUsedUSDArb.equalTo(estimatedGasUsedUSD)).toBe(true);
            expect(estimatedGasUsedGasTokenArb === null || estimatedGasUsedGasTokenArb === void 0 ? void 0 : estimatedGasUsedGasTokenArb.currency.equals(gasToken)).toBe(true);
            expect(quoteGasAdjustedArb.equalTo(quoteGasAdjusted)).toBe(true);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLWZhY3RvcnktaGVscGVycy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3JvdXRlcnMvYWxwaGEtcm91dGVyL3V0aWwvZ2FzLWZhY3RvcnktaGVscGVycy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUMxQixPQUFPLEVBQ0wsY0FBYyxFQUNkLFdBQVcsRUFDWCxnQkFBZ0IsRUFFaEIsWUFBWSxFQUNaLDBCQUEwQixFQUMxQixjQUFjLEVBQ2QsT0FBTyxFQUNQLHFCQUFxQixFQUNyQix1QkFBdUIsR0FDeEIsTUFBTSxvQkFBb0IsQ0FBQztBQUM1QixPQUFPLEVBQ0wsZ0JBQWdCLEVBQ2hCLCtCQUErQixFQUMvQiw0QkFBNEIsR0FDN0IsTUFBTSw2Q0FBNkMsQ0FBQztBQUNyRCxPQUFPLEVBQ0wsdUJBQXVCLEVBQ3ZCLGVBQWUsRUFDZixZQUFZLEVBQ1osdUJBQXVCLEVBQ3ZCLHFCQUFxQixFQUNyQix3QkFBd0IsR0FDekIsTUFBTSxpQ0FBaUMsQ0FBQztBQUN6QyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ25DLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQy9HLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUM5QyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDNUMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3hDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUczRCxNQUFNLG1CQUFtQixHQUFHO0lBQzFCLHFCQUFxQjtJQUNyQix3QkFBd0I7SUFDeEIsdUJBQXVCO0NBQ3hCLENBQUM7QUFFRixNQUFNLHVCQUF1QixHQUFHO0lBQzlC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
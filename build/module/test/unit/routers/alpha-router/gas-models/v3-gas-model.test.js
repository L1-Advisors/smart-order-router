import { CurrencyAmount, Ether } from '@uniswap/sdk-core';
import { BigNumber } from 'ethers';
import _ from 'lodash';
import { DAI_MAINNET, UNI_MAINNET, USDC_MAINNET, V3HeuristicGasModelFactory, V3Route, WRAPPED_NATIVE_CURRENCY, } from '../../../../../src';
import { BASE_SWAP_COST, COST_PER_HOP, COST_PER_INIT_TICK, NATIVE_OVERHEAD, NATIVE_UNWRAP_OVERHEAD, NATIVE_WRAP_OVERHEAD, SINGLE_HOP_OVERHEAD, } from '../../../../../src/routers/alpha-router/gas-models/v3/gas-costs';
import { DAI_USDT_LOW, DAI_WETH_MEDIUM, UNI_WETH_MEDIUM, USDC_USDT_MEDIUM, USDC_WETH_MEDIUM, } from '../../../../test-util/mock-data';
import { getV3RouteWithValidQuoteStub } from '../../../providers/caching/route/test-util/mocked-dependencies';
import { getMockedV2PoolProvider, getMockedV3PoolProvider, } from './test-util/mocked-dependencies';
import { getPools } from './test-util/helpers';
describe('v3 gas model tests', () => {
    const gasPriceWei = BigNumber.from(1000000000);
    const chainId = 1;
    const v3GasModelFactory = new V3HeuristicGasModelFactory();
    const mockedV3PoolProvider = getMockedV3PoolProvider();
    const mockedV2PoolProvider = getMockedV2PoolProvider();
    it('returns correct gas estimate for a v3 route | hops: 1 | ticks 1', async () => {
        const amountToken = USDC_MAINNET;
        const quoteToken = DAI_MAINNET;
        const pools = await getPools(amountToken, quoteToken, mockedV3PoolProvider, {});
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig: {},
        });
        const v3RouteWithQuote = getV3RouteWithValidQuoteStub({
            gasModel: v3GasModel,
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = BigNumber.from(Math.max(1, _.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromTicks = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = BASE_SWAP_COST(chainId)
            .add(COST_PER_HOP(chainId))
            .add(SINGLE_HOP_OVERHEAD(chainId))
            .add(gasOverheadFromTicks);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('returns correct gas estimate for a v3 route | hops: 2 | ticks 1', async () => {
        const amountToken = USDC_MAINNET;
        const quoteToken = DAI_MAINNET;
        const pools = await getPools(amountToken, quoteToken, mockedV3PoolProvider, {});
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig: {},
        });
        const v3RouteWithQuote = getV3RouteWithValidQuoteStub({
            gasModel: v3GasModel,
            route: new V3Route([USDC_USDT_MEDIUM, DAI_USDT_LOW], USDC_MAINNET, DAI_MAINNET),
            sqrtPriceX96AfterList: [BigNumber.from(100), BigNumber.from(100)],
            initializedTicksCrossedList: [0, 1],
        });
        const totalInitializedTicksCrossed = BigNumber.from(Math.max(1, _.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromHops = COST_PER_HOP(chainId).mul(v3RouteWithQuote.route.pools.length);
        const gasOverheadFromTicks = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = BASE_SWAP_COST(chainId)
            .add(gasOverheadFromHops)
            .add(gasOverheadFromTicks);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('applies overhead when token in is native eth', async () => {
        const amountToken = Ether.onChain(1);
        const quoteToken = USDC_MAINNET;
        const pools = await getPools(amountToken.wrapped, quoteToken, mockedV3PoolProvider, {});
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken: amountToken.wrapped,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig: {
                additionalGasOverhead: NATIVE_OVERHEAD(chainId, amountToken, quoteToken),
            },
        });
        const v3RouteWithQuote = getV3RouteWithValidQuoteStub({
            amount: CurrencyAmount.fromRawAmount(amountToken, 1),
            gasModel: v3GasModel,
            route: new V3Route([USDC_WETH_MEDIUM], WRAPPED_NATIVE_CURRENCY[1], USDC_MAINNET),
            quoteToken: USDC_MAINNET,
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = BigNumber.from(Math.max(1, _.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromHops = COST_PER_HOP(chainId).mul(v3RouteWithQuote.route.pools.length);
        const gasOverheadFromTicks = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = BASE_SWAP_COST(chainId)
            .add(gasOverheadFromHops)
            .add(gasOverheadFromTicks)
            .add(SINGLE_HOP_OVERHEAD(chainId))
            .add(NATIVE_WRAP_OVERHEAD(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('applies overhead when token out is native eth', async () => {
        const amountToken = USDC_MAINNET;
        const quoteToken = Ether.onChain(1);
        const pools = await getPools(amountToken, quoteToken.wrapped, mockedV3PoolProvider, {});
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken: quoteToken.wrapped,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig: {
                additionalGasOverhead: NATIVE_OVERHEAD(chainId, amountToken, quoteToken),
            },
        });
        const v3RouteWithQuote = getV3RouteWithValidQuoteStub({
            amount: CurrencyAmount.fromRawAmount(amountToken, 100),
            gasModel: v3GasModel,
            route: new V3Route([USDC_WETH_MEDIUM], USDC_MAINNET, WRAPPED_NATIVE_CURRENCY[1]),
            quoteToken: WRAPPED_NATIVE_CURRENCY[1],
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = BigNumber.from(Math.max(1, _.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromHops = COST_PER_HOP(chainId).mul(v3RouteWithQuote.route.pools.length);
        const gasOverheadFromTicks = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = BASE_SWAP_COST(chainId)
            .add(gasOverheadFromHops)
            .add(gasOverheadFromTicks)
            .add(SINGLE_HOP_OVERHEAD(chainId))
            .add(NATIVE_UNWRAP_OVERHEAD(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('returns gas estimate for specified gasToken', async () => {
        // copied from `returns correct gas estimate for a v3 route | hops: 1 | ticks 1` test above
        const amountToken = USDC_MAINNET;
        const quoteToken = DAI_MAINNET;
        const gasToken = UNI_MAINNET;
        const providerConfig = {
            gasToken
        };
        const pools = await getPools(amountToken, quoteToken, mockedV3PoolProvider, providerConfig, gasToken);
        expect(pools.nativeAndSpecifiedGasTokenV3Pool).toStrictEqual(UNI_WETH_MEDIUM);
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig
        });
        const v3RouteWithQuote = getV3RouteWithValidQuoteStub({
            gasModel: v3GasModel,
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = BigNumber.from(Math.max(1, _.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromTicks = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate, gasCostInToken, gasCostInUSD, gasCostInGasToken } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = BASE_SWAP_COST(chainId)
            .add(COST_PER_HOP(chainId))
            .add(SINGLE_HOP_OVERHEAD(chainId))
            .add(gasOverheadFromTicks);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
        expect(gasCostInGasToken).toBeDefined();
    });
    it('if gasToken == quoteToken returned values are equal', async () => {
        // copied from `returns correct gas estimate for a v3 route | hops: 1 | ticks 1` test above
        const amountToken = USDC_MAINNET;
        const quoteToken = DAI_MAINNET;
        const gasToken = DAI_MAINNET; // same as quoteToken
        const providerConfig = {
            gasToken
        };
        const pools = await getPools(amountToken, quoteToken, mockedV3PoolProvider, providerConfig, gasToken);
        expect(pools.nativeAndSpecifiedGasTokenV3Pool).toStrictEqual(DAI_WETH_MEDIUM);
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig
        });
        const v3RouteWithQuote = getV3RouteWithValidQuoteStub({
            gasModel: v3GasModel,
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = BigNumber.from(Math.max(1, _.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromTicks = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate, gasCostInToken, gasCostInUSD, gasCostInGasToken } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = BASE_SWAP_COST(chainId)
            .add(COST_PER_HOP(chainId))
            .add(SINGLE_HOP_OVERHEAD(chainId))
            .add(gasOverheadFromTicks);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
        expect(gasCostInGasToken).toBeDefined();
        expect(gasCostInToken.equalTo(gasCostInGasToken)).toBeTruthy();
    });
    // TODO: splits, multiple hops, token overheads, gasCostInToken, gasCostInUSD
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjMtZ2FzLW1vZGVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZ2FzLW1vZGVscy92My1nYXMtbW9kZWwudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQVksY0FBYyxFQUFFLEtBQUssRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3BFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDbkMsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBQ3ZCLE9BQU8sRUFDTCxXQUFXLEVBQ1gsV0FBVyxFQUNYLFlBQVksRUFDWiwwQkFBMEIsRUFDMUIsT0FBTyxFQUNQLHVCQUF1QixHQUN4QixNQUFNLG9CQUFvQixDQUFDO0FBQzVCLE9BQU8sRUFDTCxjQUFjLEVBQ2QsWUFBWSxFQUNaLGtCQUFrQixFQUNsQixlQUFlLEVBQ2Ysc0JBQXNCLEVBQ3RCLG9CQUFvQixFQUNwQixtQkFBbUIsR0FDcEIsTUFBTSxpRUFBaUUsQ0FBQztBQUN6RSxPQUFPLEVBQ0wsWUFBWSxFQUNaLGVBQWUsRUFDZixlQUFlLEVBQ2YsZ0JBQWdCLEVBQ2hCLGdCQUFnQixHQUNqQixNQUFNLGlDQUFpQyxDQUFDO0FBQ3pDLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQzlHLE9BQU8sRUFDTCx1QkFBdUIsRUFDdkIsdUJBQXVCLEdBQ3hCLE1BQU0saUNBQWlDLENBQUM7QUFDekMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRS9DLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7SUFDbEMsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMvQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDbEIsTUFBTSxpQkFBaUIsR0FB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
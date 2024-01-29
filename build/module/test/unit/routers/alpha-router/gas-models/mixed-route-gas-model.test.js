import { partitionMixedRouteByProtocol } from '@uniswap/router-sdk';
import { CurrencyAmount, Ether } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import { Pool } from '@uniswap/v3-sdk';
import { BigNumber } from 'ethers';
import _ from 'lodash';
import { DAI_MAINNET, MixedRoute, USDC_MAINNET, WRAPPED_NATIVE_CURRENCY, } from '../../../../../src';
import { MixedRouteHeuristicGasModelFactory } from '../../../../../src/routers/alpha-router/gas-models/mixedRoute/mixed-route-heuristic-gas-model';
import { BASE_SWAP_COST as BASE_SWAP_COST_V2, COST_PER_EXTRA_HOP as COST_PER_EXTRA_HOP_V2, } from '../../../../../src/routers/alpha-router/gas-models/v2/v2-heuristic-gas-model';
import { BASE_SWAP_COST, COST_PER_HOP, COST_PER_INIT_TICK, COST_PER_UNINIT_TICK, NATIVE_OVERHEAD, NATIVE_UNWRAP_OVERHEAD, NATIVE_WRAP_OVERHEAD, } from '../../../../../src/routers/alpha-router/gas-models/v3/gas-costs';
import { USDC_DAI, USDC_DAI_MEDIUM, USDC_WETH_MEDIUM, WETH_DAI, } from '../../../../test-util/mock-data';
import { getMixedRouteWithValidQuoteStub } from '../../../providers/caching/route/test-util/mocked-dependencies';
import { getMockedV2PoolProvider, getMockedV3PoolProvider, } from './test-util/mocked-dependencies';
import { getPools } from './test-util/helpers';
describe('mixed route gas model tests', () => {
    const gasPriceWei = BigNumber.from(1000000000);
    const chainId = 1;
    const mixedGasModelFactory = new MixedRouteHeuristicGasModelFactory();
    const mockedV3PoolProvider = getMockedV3PoolProvider();
    const mockedV2PoolProvider = getMockedV2PoolProvider();
    function calculateGasEstimate(routeWithValidQuote) {
        // copied from mixed route heuristic gas model
        let baseGasUse = BigNumber.from(0);
        const route = routeWithValidQuote.route;
        const res = partitionMixedRouteByProtocol(route);
        res.map((section) => {
            if (section.every((pool) => pool instanceof Pool)) {
                baseGasUse = baseGasUse.add(BASE_SWAP_COST(chainId));
                baseGasUse = baseGasUse.add(COST_PER_HOP(chainId).mul(section.length));
            }
            else if (section.every((pool) => pool instanceof Pair)) {
                baseGasUse = baseGasUse.add(BASE_SWAP_COST_V2);
                baseGasUse = baseGasUse.add(
                /// same behavior in v2 heuristic gas model factory
                COST_PER_EXTRA_HOP_V2.mul(section.length - 1));
            }
        });
        const totalInitializedTicksCrossed = BigNumber.from(Math.max(1, _.sum(routeWithValidQuote.initializedTicksCrossedList)));
        const tickGasUse = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const uninitializedTickGasUse = COST_PER_UNINIT_TICK.mul(0);
        // base estimate gas used based on chainId estimates for hops and ticks gas useage
        baseGasUse = baseGasUse.add(tickGasUse).add(uninitializedTickGasUse);
        return baseGasUse;
    }
    it('returns correct gas estimate for a mixed route | hops: 2 | ticks 1', async () => {
        const amountToken = USDC_MAINNET;
        const quoteToken = DAI_MAINNET;
        const pools = await getPools(amountToken, quoteToken, mockedV3PoolProvider, {});
        const mixedGasModel = await mixedGasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            providerConfig: {},
        });
        const mixedRouteWithQuote = getMixedRouteWithValidQuoteStub({
            mixedRouteGasModel: mixedGasModel,
            initializedTicksCrossedList: [1],
        });
        const { gasEstimate } = mixedGasModel.estimateGasCost(mixedRouteWithQuote);
        const expectedGasCost = calculateGasEstimate(mixedRouteWithQuote);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('applies overhead when token in is native eth', async () => {
        const amountToken = Ether.onChain(1);
        const quoteToken = DAI_MAINNET;
        const pools = await getPools(amountToken.wrapped, quoteToken, mockedV3PoolProvider, {});
        const mixedGasModel = await mixedGasModelFactory.buildGasModel({
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
        const mixedRouteWithQuote = getMixedRouteWithValidQuoteStub({
            amount: CurrencyAmount.fromRawAmount(amountToken, 1),
            mixedRouteGasModel: mixedGasModel,
            route: new MixedRoute([USDC_WETH_MEDIUM, USDC_DAI], WRAPPED_NATIVE_CURRENCY[1], DAI_MAINNET),
            quoteToken: DAI_MAINNET,
            initializedTicksCrossedList: [1],
        });
        const { gasEstimate } = mixedGasModel.estimateGasCost(mixedRouteWithQuote);
        const expectedGasCost = calculateGasEstimate(mixedRouteWithQuote).add(NATIVE_WRAP_OVERHEAD(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('applies overhead when token out is native eth', async () => {
        const amountToken = USDC_MAINNET;
        const quoteToken = Ether.onChain(1);
        const pools = await getPools(amountToken, quoteToken.wrapped, mockedV3PoolProvider, {});
        const mixedGasModel = await mixedGasModelFactory.buildGasModel({
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
        const mixedRouteWithQuote = getMixedRouteWithValidQuoteStub({
            amount: CurrencyAmount.fromRawAmount(amountToken, 100),
            mixedRouteGasModel: mixedGasModel,
            route: new MixedRoute([USDC_DAI_MEDIUM, WETH_DAI], USDC_MAINNET, WRAPPED_NATIVE_CURRENCY[1]),
            quoteToken: WRAPPED_NATIVE_CURRENCY[1],
            initializedTicksCrossedList: [1],
        });
        const { gasEstimate } = mixedGasModel.estimateGasCost(mixedRouteWithQuote);
        const expectedGasCost = calculateGasEstimate(mixedRouteWithQuote).add(NATIVE_UNWRAP_OVERHEAD(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    // TODO: splits, multiple hops, token overheads, gasCostInToken, gasCostInUSD
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWl4ZWQtcm91dGUtZ2FzLW1vZGVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZ2FzLW1vZGVscy9taXhlZC1yb3V0ZS1nYXMtbW9kZWwudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNwRSxPQUFPLEVBQVksY0FBYyxFQUFFLEtBQUssRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3BFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDdkMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUNuQyxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFDdkIsT0FBTyxFQUNMLFdBQVcsRUFDWCxVQUFVLEVBRVYsWUFBWSxFQUNaLHVCQUF1QixHQUN4QixNQUFNLG9CQUFvQixDQUFDO0FBQzVCLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLCtGQUErRixDQUFDO0FBQ25KLE9BQU8sRUFDTCxjQUFjLElBQUksaUJBQWlCLEVBQ25DLGtCQUFrQixJQUFJLHFCQUFxQixHQUM1QyxNQUFNLDhFQUE4RSxDQUFDO0FBQ3RGLE9BQU8sRUFDTCxjQUFjLEVBQ2QsWUFBWSxFQUNaLGtCQUFrQixFQUNsQixvQkFBb0IsRUFDcEIsZUFBZSxFQUNmLHNCQUFzQixFQUN0QixvQkFBb0IsR0FDckIsTUFBTSxpRUFBaUUsQ0FBQztBQUN6RSxPQUFPLEVBQ0wsUUFBUSxFQUNSLGVBQWUsRUFDZixnQkFBZ0IsRUFDaEIsUUFBUSxHQUNULE1BQU0saUNBQWlDLENBQUM7QUFDekMsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDakgsT0FB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
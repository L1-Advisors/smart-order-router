import { Ether } from '@uniswap/sdk-core';
import { BigNumber } from 'ethers';
import { DAI_MAINNET, USDC_MAINNET, V2Route } from '../../../../../src';
import { BASE_SWAP_COST, COST_PER_EXTRA_HOP, V2HeuristicGasModelFactory, } from '../../../../../src/routers/alpha-router/gas-models/v2/v2-heuristic-gas-model';
import { NATIVE_OVERHEAD, NATIVE_WRAP_OVERHEAD, } from '../../../../../src/routers/alpha-router/gas-models/v3/gas-costs';
import { WETH_DAI } from '../../../../test-util/mock-data';
import { getV2RouteWithValidQuoteStub } from '../../../providers/caching/route/test-util/mocked-dependencies';
import { getMockedV2PoolProvider } from './test-util/mocked-dependencies';
describe('v2 gas model tests', () => {
    const gasPriceWei = BigNumber.from(1000000000);
    const chainId = 1;
    const v2GasModelFactory = new V2HeuristicGasModelFactory();
    const mockedV2PoolProvider = getMockedV2PoolProvider();
    it('returns correct gas estimate for a v2 route | hops: 1', async () => {
        const quoteToken = DAI_MAINNET;
        const v2GasModel = await v2GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            poolProvider: mockedV2PoolProvider,
            token: quoteToken,
            providerConfig: {},
        });
        const v2RouteWithQuote = getV2RouteWithValidQuoteStub({
            gasModel: v2GasModel,
        });
        const { gasEstimate, gasCostInToken, gasCostInUSD } = v2GasModel.estimateGasCost(v2RouteWithQuote);
        const hops = v2RouteWithQuote.route.pairs.length;
        let expectedGasCost = BASE_SWAP_COST.add(COST_PER_EXTRA_HOP.mul(hops - 1));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
    });
    it('applies overhead when token in is native eth', async () => {
        const amountToken = Ether.onChain(1);
        const quoteToken = DAI_MAINNET;
        const v2GasModel = await v2GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            poolProvider: mockedV2PoolProvider,
            token: quoteToken,
            providerConfig: {
                additionalGasOverhead: NATIVE_OVERHEAD(chainId, amountToken, quoteToken),
            },
        });
        expect(NATIVE_OVERHEAD(chainId, amountToken, quoteToken).eq(NATIVE_WRAP_OVERHEAD(chainId))).toBe(true);
        const v2RouteWithQuote = getV2RouteWithValidQuoteStub({
            route: new V2Route([WETH_DAI], amountToken.wrapped, quoteToken),
            gasModel: v2GasModel,
        });
        const { gasEstimate, gasCostInToken, gasCostInUSD } = v2GasModel.estimateGasCost(v2RouteWithQuote);
        const hops = v2RouteWithQuote.route.pairs.length;
        let expectedGasCost = BASE_SWAP_COST.add(COST_PER_EXTRA_HOP.mul(hops - 1)).add(NATIVE_WRAP_OVERHEAD(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
    });
    it('returns gas estimate for specified gasToken', async () => {
        // copied from 'returns correct gas estimate for a v2 route | hops: 1'
        const quoteToken = DAI_MAINNET;
        const gasToken = USDC_MAINNET;
        const v2GasModel = await v2GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            poolProvider: mockedV2PoolProvider,
            token: quoteToken,
            providerConfig: {
                gasToken: gasToken
            },
        });
        const v2RouteWithQuote = getV2RouteWithValidQuoteStub({
            gasModel: v2GasModel,
        });
        const { gasEstimate, gasCostInToken, gasCostInUSD, gasCostInGasToken } = v2GasModel.estimateGasCost(v2RouteWithQuote);
        const hops = v2RouteWithQuote.route.pairs.length;
        let expectedGasCost = BASE_SWAP_COST.add(COST_PER_EXTRA_HOP.mul(hops - 1));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
        expect(gasCostInGasToken).toBeDefined();
        expect(gasCostInGasToken === null || gasCostInGasToken === void 0 ? void 0 : gasCostInGasToken.currency.equals(gasToken)).toBe(true);
    });
    // TODO: splits, multiple hops, token overheads, gasCostInToken, gasCostInUSD
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjItZ2FzLW1vZGVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZ2FzLW1vZGVscy92Mi1nYXMtbW9kZWwudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQVksS0FBSyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDcEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUNuQyxPQUFPLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN4RSxPQUFPLEVBQ0wsY0FBYyxFQUNkLGtCQUFrQixFQUNsQiwwQkFBMEIsR0FDM0IsTUFBTSw4RUFBOEUsQ0FBQztBQUN0RixPQUFPLEVBQ0wsZUFBZSxFQUNmLG9CQUFvQixHQUNyQixNQUFNLGlFQUFpRSxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUM5RyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUUxRSxRQUFRLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO0lBQ2xDLE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDL0MsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBQ2xCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSwwQkFBMEIsRUFBRSxDQUFDO0lBRTNELE1BQU0sb0JBQW9CLEdBQUcsdUJBQXVCLEVBQUUsQ0FBQztJQUV2RCxFQUFFLENBQUMsdURBQXVELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDckUsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDO1FBRS9CLE1BQU0sVUFBVSxHQUFHLE1BQU0saUJBQWlC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
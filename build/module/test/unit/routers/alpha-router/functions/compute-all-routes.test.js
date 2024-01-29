import { Pair } from '@uniswap/v2-sdk';
import { encodeSqrtRatioX96, FeeAmount, Pool } from '@uniswap/v3-sdk';
import { CurrencyAmount, DAI_MAINNET as DAI, USDC_MAINNET as USDC, USDT_MAINNET as USDT, WBTC_MAINNET as WBTC, WRAPPED_NATIVE_CURRENCY, } from '../../../../../src';
import { computeAllMixedRoutes, computeAllV2Routes, computeAllV3Routes } from '../../../../../src/routers/alpha-router/functions/compute-all-routes';
import { DAI_USDT, DAI_USDT_LOW, USDC_DAI, USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_USDT, USDC_WETH, USDC_WETH_LOW, WBTC_WETH, WETH9_USDT_LOW, WETH_USDT, } from '../../../../test-util/mock-data';
describe('compute all v3 routes', () => {
    test('succeeds to compute all routes', async () => {
        const pools = [
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
        ];
        const routes = computeAllV3Routes(USDC, DAI, pools, 3);
        expect(routes).toHaveLength(3);
    });
    test('succeeds to compute all routes with 1 hop', async () => {
        const pools = [
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
        ];
        const routes = computeAllV3Routes(USDC, DAI, pools, 1);
        expect(routes).toHaveLength(2);
    });
    test('succeeds to compute all routes with 4 hops, ignoring arbitrage opportunities', async () => {
        const pools = [
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
        ];
        const routes = computeAllV3Routes(USDC, WRAPPED_NATIVE_CURRENCY[1], pools, 4);
        routes.forEach((route) => {
            expect(route.pools).not.toEqual([USDC_DAI_MEDIUM, USDC_DAI_LOW, USDC_WETH_LOW]);
        });
        expect(routes).toHaveLength(3);
    });
    test('succeeds when no routes', async () => {
        const pools = [
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
            new Pool(USDT, WBTC, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 500, 0),
        ];
        // No way to get from USDC to WBTC in 2 hops
        const routes = computeAllV3Routes(USDC, WBTC, pools, 2);
        expect(routes).toHaveLength(0);
    });
});
describe('compute all mixed routes', () => {
    test('succeeds to compute all routes', async () => {
        const pools = [
            DAI_USDT,
            USDC_WETH,
            WETH_USDT,
            USDC_DAI,
            WBTC_WETH,
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
        ];
        const routes = computeAllMixedRoutes(USDC, DAI, pools, 3);
        expect(routes).toHaveLength(6);
    });
    test('fails to compute all routes with 1 hop (since mixed requires at least 2 hops)', async () => {
        const pools = [
            DAI_USDT,
            USDC_WETH,
            WETH_USDT,
            USDC_DAI,
            WBTC_WETH,
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
        ];
        const routes = computeAllMixedRoutes(USDC, DAI, pools, 1);
        expect(routes).toHaveLength(0);
    });
    test('succeeds to compute all routes with 2 hops', async () => {
        const pools = [
            DAI_USDT,
            USDC_WETH,
            WETH_USDT,
            USDC_DAI,
            USDC_USDT,
            WBTC_WETH,
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
        ];
        const routes = computeAllMixedRoutes(USDC, DAI, pools, 2);
        expect(routes).toHaveLength(1);
    });
    test('succeeds to compute all routes with 5 hops. ignoring arbitrage opportunities', async () => {
        const pools = [
            DAI_USDT,
            USDC_DAI,
            USDC_USDT,
            USDC_WETH,
            WETH_USDT,
            WBTC_WETH,
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
        ];
        const routes = computeAllMixedRoutes(USDC, WRAPPED_NATIVE_CURRENCY[1], pools, 4);
        routes.forEach((route) => {
            expect(route.pools).not.toEqual([USDC_DAI, USDC_DAI_LOW, USDC_WETH]);
            expect(route.pools).not.toEqual([USDC_DAI, USDC_DAI_MEDIUM, USDC_WETH]);
            expect(route.pools).not.toEqual([USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_WETH]);
            expect(route.pools).not.toEqual([USDC_DAI_LOW, USDC_DAI, USDC_WETH]);
            expect(route.pools).not.toEqual([USDC_DAI_MEDIUM, USDC_DAI_LOW, USDC_WETH]);
            expect(route.pools).not.toEqual([USDC_DAI_MEDIUM, USDC_DAI, USDC_WETH]);
        });
        expect(routes).toHaveLength(10);
    });
    test('succeeds when no routes', async () => {
        const pools = [
            DAI_USDT,
            WETH_USDT,
            USDC_DAI,
            WBTC_WETH,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
            new Pair(CurrencyAmount.fromRawAmount(USDT, 10), CurrencyAmount.fromRawAmount(WBTC, 10)),
        ];
        // No way to get from USDC to WBTC in 2 hops
        const routes = computeAllMixedRoutes(USDC, WBTC, pools, 2);
        expect(routes).toHaveLength(0);
    });
});
describe('compute all v2 routes', () => {
    test('succeeds to compute all routes', async () => {
        const pools = [DAI_USDT, USDC_WETH, WETH_USDT, USDC_DAI, WBTC_WETH];
        const routes = computeAllV2Routes(USDC, DAI, pools, 3);
        expect(routes).toHaveLength(2);
    });
    test('succeeds to compute all routes with 1 hop', async () => {
        const pools = [DAI_USDT, USDC_WETH, WETH_USDT, USDC_DAI, WBTC_WETH];
        const routes = computeAllV2Routes(USDC, DAI, pools, 1);
        expect(routes).toHaveLength(1);
    });
    test('succeeds to compute all routes with 5 hops. ignoring arbitrage opportunities', async () => {
        const pools = [DAI_USDT, USDC_DAI, USDC_USDT, USDC_WETH, WETH_USDT, WBTC_WETH];
        const routes = computeAllV2Routes(USDC, WRAPPED_NATIVE_CURRENCY[1], pools, 5);
        routes.forEach((route) => {
            expect(route.pairs).not.toEqual([USDC_USDT, DAI_USDT, USDC_DAI, USDC_WETH]);
            expect(route.pairs).not.toEqual([USDC_DAI, DAI_USDT, USDC_USDT, USDC_WETH]);
        });
        expect(routes).toHaveLength(3);
    });
    test('succeeds when no routes', async () => {
        const pools = [
            DAI_USDT,
            WETH_USDT,
            USDC_DAI,
            WBTC_WETH,
            new Pair(CurrencyAmount.fromRawAmount(USDT, 10), CurrencyAmount.fromRawAmount(WBTC, 10)),
        ];
        // No way to get from USDC to WBTC in 2 hops
        const routes = computeAllV2Routes(USDC, WBTC, pools, 2);
        expect(routes).toHaveLength(0);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1hbGwtcm91dGVzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZnVuY3Rpb25zL2NvbXB1dGUtYWxsLXJvdXRlcy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3RFLE9BQU8sRUFDTCxjQUFjLEVBQ2QsV0FBVyxJQUFJLEdBQUcsRUFDbEIsWUFBWSxJQUFJLElBQUksRUFDcEIsWUFBWSxJQUFJLElBQUksRUFDcEIsWUFBWSxJQUFJLElBQUksRUFDcEIsdUJBQXVCLEdBQ3hCLE1BQU0sb0JBQW9CLENBQUM7QUFDNUIsT0FBTyxFQUNMLHFCQUFxQixFQUNyQixrQkFBa0IsRUFDbEIsa0JBQWtCLEVBQ25CLE1BQU0sc0VBQXNFLENBQUM7QUFDOUUsT0FBTyxFQUNMLFFBQVEsRUFDUixZQUFZLEVBQ1osUUFBUSxFQUNSLFlBQVksRUFDWixlQUFlLEVBQ2YsU0FBUyxFQUNULFNBQVMsRUFDVCxhQUFhLEVBQ2IsU0FBUyxFQUNULGNBQWMsRUFDZCxTQUFTLEdBQ1YsTUFBTSxpQ0FBaUMsQ0FBQztBQUV6QyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFO0lBQ3JDLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNoRCxNQUFNLEtBQUssR0FBRztZQUNaLFlBQVk7WUFDWixlQUFlO1lBQ2YsYUFBYTtZQUNiLGNBQWM7WUFDZCxZQUFZO1NBQ2IsQ0FBQztRQUNGLE1BQU0sTUFBTSxHQUFHLGtCQUFrQixDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRXZELE1B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
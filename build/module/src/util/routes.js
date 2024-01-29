import { Protocol } from '@uniswap/router-sdk';
import { Percent } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import { Pool } from '@uniswap/v3-sdk';
import _ from 'lodash';
import { V3_CORE_FACTORY_ADDRESSES } from './addresses';
import { CurrencyAmount } from '.';
export const routeToString = (route) => {
    const routeStr = [];
    const tokens = route.protocol === Protocol.V3
        ? route.tokenPath
        : // MixedRoute and V2Route have path
            route.path;
    const tokenPath = _.map(tokens, (token) => `${token.symbol}`);
    const pools = route.protocol === Protocol.V3 || route.protocol === Protocol.MIXED
        ? route.pools
        : route.pairs;
    const poolFeePath = _.map(pools, (pool) => {
        return `${pool instanceof Pool
            ? ` -- ${pool.fee / 10000}% [${Pool.getAddress(pool.token0, pool.token1, pool.fee, undefined, V3_CORE_FACTORY_ADDRESSES[pool.chainId])}]`
            : ` -- [${Pair.getAddress(pool.token0, pool.token1)}]`} --> `;
    });
    for (let i = 0; i < tokenPath.length; i++) {
        routeStr.push(tokenPath[i]);
        if (i < poolFeePath.length) {
            routeStr.push(poolFeePath[i]);
        }
    }
    return routeStr.join('');
};
export const routeAmountsToString = (routeAmounts) => {
    const total = _.reduce(routeAmounts, (total, cur) => {
        return total.add(cur.amount);
    }, CurrencyAmount.fromRawAmount(routeAmounts[0].amount.currency, 0));
    const routeStrings = _.map(routeAmounts, ({ protocol, route, amount }) => {
        const portion = amount.divide(total);
        const percent = new Percent(portion.numerator, portion.denominator);
        /// @dev special case for MIXED routes we want to show user friendly V2+V3 instead
        return `[${protocol == Protocol.MIXED ? 'V2 + V3' : protocol}] ${percent.toFixed(2)}% = ${routeToString(route)}`;
    });
    return _.join(routeStrings, ', ');
};
export const routeAmountToString = (routeAmount) => {
    const { route, amount } = routeAmount;
    return `${amount.toExact()} = ${routeToString(route)}`;
};
export const poolToString = (p) => {
    return `${p.token0.symbol}/${p.token1.symbol}${p instanceof Pool ? `/${p.fee / 10000}%` : ``}`;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3V0aWwvcm91dGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDNUMsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFLdkIsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRXhELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxHQUFHLENBQUM7QUFFbkMsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLENBQzNCLEtBQXFDLEVBQzdCLEVBQUU7SUFDVixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUM7SUFDcEIsTUFBTSxNQUFNLEdBQ1YsS0FBSyxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUMsRUFBRTtRQUM1QixDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVM7UUFDakIsQ0FBQyxDQUFDLG1DQUFtQztZQUNuQyxLQUFLLENBQUMsSUFBSSxDQUFDO0lBQ2pCLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzlELE1BQU0sS0FBSyxHQUNULEtBQUssQ0FBQyxRQUFRLEtBQUssUUFBUSxDQUFDLEVBQUUsSUFBSSxLQUFLLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxLQUFLO1FBQ2pFLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSztRQUNiLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQ2xC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
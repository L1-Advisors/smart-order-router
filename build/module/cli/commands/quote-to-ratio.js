import { Logger } from '@ethersproject/logger';
import { flags } from '@oclif/command';
import { Ether, Fraction, Percent } from '@uniswap/sdk-core';
import { Position } from '@uniswap/v3-sdk';
import dotenv from 'dotenv';
import { ID_TO_CHAIN_ID, parseAmount, SwapToRatioStatus, SwapType, } from '../../src';
import { BaseCommand } from '../base-command';
dotenv.config();
Logger.globalLogger();
Logger.setLogLevel(Logger.levels.DEBUG);
export class QuoteToRatio extends BaseCommand {
    async run() {
        const { flags } = this.parse(QuoteToRatio);
        const { chainId: chainIdNumb, token0: token0Str, token1: token1Str, token0Balance: token0BalanceStr, token1Balance: token1BalanceStr, feeAmount, tickLower, tickUpper, recipient, debug, topN, topNTokenInOut, topNSecondHop, topNWithEachBaseToken, topNWithBaseToken, topNWithBaseTokenInSet, maxSwapsPerPath, minSplits, maxSplits, distributionPercent, } = flags;
        const log = this.logger;
        const router = this.swapToRatioRouter;
        const tokenProvider = this.tokenProvider;
        const tokenAccessor = await tokenProvider.getTokens([token0Str, token1Str]);
        const chainId = ID_TO_CHAIN_ID(chainIdNumb);
        // TODO add support for polygon
        const token0 = token0Str == 'ETH'
            ? Ether.onChain(chainId)
            : tokenAccessor.getTokenByAddress(token0Str);
        const token1 = token1Str == 'ETH'
            ? Ether.onChain(chainId)
            : tokenAccessor.getTokenByAddress(token1Str);
        const token0Balance = parseAmount(token0BalanceStr, token0);
        const token1Balance = parseAmount(token1BalanceStr, token1);
        const poolAccessor = await this.poolProvider.getPools([[token0.wrapped, token1.wrapped, feeAmount]], { blockNumber: this.blockNumber });
        const pool = poolAccessor.getPool(token0.wrapped, token1.wrapped, feeAmount);
        if (!pool) {
            log.error(`Could not find pool. ${debug ? '' : 'Run in debug mode for more info'}.`);
            return;
        }
        const position = new Position({
            pool,
            tickUpper,
            tickLower,
            liquidity: 1,
        });
        let swapRoutes;
        swapRoutes = await router.routeToRatio(token0Balance, token1Balance, position, {
            ratioErrorTolerance: new Fraction(1, 100),
            maxIterations: 6,
        }, {
            addLiquidityOptions: {
                recipient: '0x0000000000000000000000000000000000000001',
            },
            swapOptions: {
                type: SwapType.SWAP_ROUTER_02,
                deadline: 100,
                recipient,
                slippageTolerance: new Percent(5, 10000),
            },
        }, {
            blockNumber: this.blockNumber,
            topN,
            topNTokenInOut,
            topNSecondHop,
            topNWithEachBaseToken,
            topNWithBaseToken,
            topNWithBaseTokenInSet,
            maxSwapsPerPath,
            minSplits,
            maxSplits,
            distributionPercent,
        });
        if (swapRoutes.status === SwapToRatioStatus.SUCCESS) {
            const { blockNumber, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, gasPriceWei, methodParameters, quote, quoteGasAdjusted, route: routeAmounts, } = swapRoutes.result;
            this.logSwapResults(routeAmounts, quote, quoteGasAdjusted, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, methodParameters, blockNumber, estimatedGasUsed, gasPriceWei);
            return;
        }
        else if (swapRoutes.status === SwapToRatioStatus.NO_ROUTE_FOUND) {
            log.error(`${swapRoutes.error}. ${debug ? '' : 'Run in debug mode for more info'}.`);
            return;
        }
        else if (swapRoutes.status === SwapToRatioStatus.NO_SWAP_NEEDED) {
            log.error(`no swap needed. ${debug ? '' : 'Run in debug mode for more info'}.`);
            return;
        }
    }
}
QuoteToRatio.description = 'Uniswap Smart Order Router CLI';
QuoteToRatio.flags = {
    ...BaseCommand.flags,
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    token0: flags.string({ char: 'i', required: true }),
    token1: flags.string({ char: 'o', required: true }),
    feeAmount: flags.integer({ char: 'f', required: true }),
    token0Balance: flags.string({ required: true }),
    token1Balance: flags.string({ required: true }),
    recipient: flags.string({ required: true }),
    tickLower: flags.integer({ required: true }),
    tickUpper: flags.integer({ required: true }),
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUtdG8tcmF0aW8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jbGkvY29tbWFuZHMvcXVvdGUtdG8tcmF0aW8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQy9DLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN2QyxPQUFPLEVBQVksS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUN2RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFDTCxjQUFjLEVBQ2QsV0FBVyxFQUVYLGlCQUFpQixFQUNqQixRQUFRLEdBQ1QsTUFBTSxXQUFXLENBQUM7QUFDbkIsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRTlDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUVoQixNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7QUFDdEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRXhDLE1BQU0sT0FBTyxZQUFhLFNBQVEsV0FBVztJQWlCM0MsS0FBSyxDQUFDLEdBQUc7UUFDUCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMzQyxNQUFNLEVBQ0osT0FBTyxFQUFFLFdBQVcsRUFDcEIsTUFBTSxFQUFFLFNBQVMsRUFDakIsTUFBTSxFQUFFLFNBQVMsRUFDakIsYUFBYSxFQUFFLGdCQUFnQixFQUMvQixhQUFhLEVBQUUsZ0JBQWdCLEVBQy9CLFNBQVMsRUFDVCxTQUFTLEVBQ1QsU0FBUyxFQUNULFNBQVMsRUFDVCxLQUFLLEVBQ0wsSUFBSSxFQUNK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Q0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDL0IsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUNuRCxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ25ELFNBQVMsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDdkQsYUFBYSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDL0MsYUFBYSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDL0MsU0FBUyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDM0MsU0FBUyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDNUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7Q0FDN0MsQ0FBQyJ9
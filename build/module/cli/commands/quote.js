import { Logger } from '@ethersproject/logger';
import { flags } from '@oclif/command';
import { Protocol } from '@uniswap/router-sdk';
import { Percent, TradeType } from '@uniswap/sdk-core';
import dotenv from 'dotenv';
import _ from 'lodash';
import { ID_TO_CHAIN_ID, MapWithLowerCaseKey, nativeOnChain, parseAmount, SwapType, } from '../../src';
import { NATIVE_NAMES_BY_ID, TO_PROTOCOL } from '../../src/util';
import { BaseCommand } from '../base-command';
dotenv.config();
Logger.globalLogger();
Logger.setLogLevel(Logger.levels.DEBUG);
export class Quote extends BaseCommand {
    async run() {
        const { flags } = this.parse(Quote);
        const { tokenIn: tokenInStr, tokenOut: tokenOutStr, amount: amountStr, exactIn, exactOut, recipient, debug, topN, topNTokenInOut, topNSecondHop, topNSecondHopForTokenAddressRaw, topNWithEachBaseToken, topNWithBaseToken, topNWithBaseTokenInSet, topNDirectSwaps, maxSwapsPerPath, minSplits, maxSplits, distributionPercent, chainId: chainIdNumb, protocols: protocolsStr, forceCrossProtocol, forceMixedRoutes, simulate, debugRouting, enableFeeOnTransferFeeFetching, requestBlockNumber, gasToken } = flags;
        const topNSecondHopForTokenAddress = new MapWithLowerCaseKey();
        topNSecondHopForTokenAddressRaw.split(',').forEach((entry) => {
            if (entry != '') {
                const entryParts = entry.split('|');
                if (entryParts.length != 2) {
                    throw new Error('flag --topNSecondHopForTokenAddressRaw must be in format tokenAddress|topN,...');
                }
                const topNForTokenAddress = Number(entryParts[1]);
                topNSecondHopForTokenAddress.set(entryParts[0], topNForTokenAddress);
            }
        });
        if ((exactIn && exactOut) || (!exactIn && !exactOut)) {
            throw new Error('Must set either --exactIn or --exactOut.');
        }
        let protocols = [];
        if (protocolsStr) {
            try {
                protocols = _.map(protocolsStr.split(','), (protocolStr) => TO_PROTOCOL(protocolStr));
            }
            catch (err) {
                throw new Error(`Protocols invalid. Valid options: ${Object.values(Protocol)}`);
            }
        }
        const chainId = ID_TO_CHAIN_ID(chainIdNumb);
        const log = this.logger;
        const tokenProvider = this.tokenProvider;
        const router = this.router;
        // if the tokenIn str is 'ETH' or 'MATIC' or in NATIVE_NAMES_BY_ID
        const tokenIn = NATIVE_NAMES_BY_ID[chainId].includes(tokenInStr)
            ? nativeOnChain(chainId)
            : (await tokenProvider.getTokens([tokenInStr])).getTokenByAddress(tokenInStr);
        const tokenOut = NATIVE_NAMES_BY_ID[chainId].includes(tokenOutStr)
            ? nativeOnChain(chainId)
            : (await tokenProvider.getTokens([tokenOutStr])).getTokenByAddress(tokenOutStr);
        let swapRoutes;
        if (exactIn) {
            const amountIn = parseAmount(amountStr, tokenIn);
            swapRoutes = await router.route(amountIn, tokenOut, TradeType.EXACT_INPUT, recipient
                ? {
                    type: SwapType.UNIVERSAL_ROUTER,
                    deadlineOrPreviousBlockhash: 10000000000000,
                    recipient,
                    slippageTolerance: new Percent(5, 100),
                    simulate: simulate ? { fromAddress: recipient } : undefined,
                }
                : undefined, {
                blockNumber: requestBlockNumber !== null && requestBlockNumber !== void 0 ? requestBlockNumber : this.blockNumber,
                v3PoolSelection: {
                    topN,
                    topNTokenInOut,
                    topNSecondHop,
                    topNSecondHopForTokenAddress,
                    topNWithEachBaseToken,
                    topNWithBaseToken,
                    topNWithBaseTokenInSet,
                    topNDirectSwaps,
                },
                maxSwapsPerPath,
                minSplits,
                maxSplits,
                distributionPercent,
                protocols,
                forceCrossProtocol,
                forceMixedRoutes,
                debugRouting,
                enableFeeOnTransferFeeFetching,
                gasToken
            });
        }
        else {
            const amountOut = parseAmount(amountStr, tokenOut);
            swapRoutes = await router.route(amountOut, tokenIn, TradeType.EXACT_OUTPUT, recipient
                ? {
                    type: SwapType.SWAP_ROUTER_02,
                    deadline: 100,
                    recipient,
                    slippageTolerance: new Percent(5, 10000),
                }
                : undefined, {
                blockNumber: this.blockNumber - 10,
                v3PoolSelection: {
                    topN,
                    topNTokenInOut,
                    topNSecondHop,
                    topNSecondHopForTokenAddress,
                    topNWithEachBaseToken,
                    topNWithBaseToken,
                    topNWithBaseTokenInSet,
                    topNDirectSwaps,
                },
                maxSwapsPerPath,
                minSplits,
                maxSplits,
                distributionPercent,
                protocols,
                forceCrossProtocol,
                forceMixedRoutes,
                debugRouting,
                enableFeeOnTransferFeeFetching,
                gasToken
            });
        }
        if (!swapRoutes) {
            log.error(`Could not find route. ${debug ? '' : 'Run in debug mode for more info'}.`);
            return;
        }
        const { blockNumber, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, gasPriceWei, methodParameters, quote, quoteGasAdjusted, route: routeAmounts, simulationStatus, } = swapRoutes;
        this.logSwapResults(routeAmounts, quote, quoteGasAdjusted, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, methodParameters, blockNumber, estimatedGasUsed, gasPriceWei, simulationStatus);
    }
}
Quote.description = 'Uniswap Smart Order Router CLI';
Quote.flags = {
    ...BaseCommand.flags,
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    tokenIn: flags.string({ char: 'i', required: true }),
    tokenOut: flags.string({ char: 'o', required: true }),
    recipient: flags.string({ required: false }),
    amount: flags.string({ char: 'a', required: true }),
    exactIn: flags.boolean({ required: false }),
    exactOut: flags.boolean({ required: false }),
    protocols: flags.string({ required: false }),
    forceCrossProtocol: flags.boolean({ required: false, default: false }),
    forceMixedRoutes: flags.boolean({
        required: false,
        default: false,
    }),
    simulate: flags.boolean({ required: false, default: false }),
    debugRouting: flags.boolean({ required: false, default: true }),
    enableFeeOnTransferFeeFetching: flags.boolean({ required: false, default: false }),
    requestBlockNumber: flags.integer({ required: false }),
    gasToken: flags.string({ required: false }),
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jbGkvY29tbWFuZHMvcXVvdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQy9DLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN2QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDL0MsT0FBTyxFQUFZLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNqRSxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXZCLE9BQU8sRUFBRSxjQUFjLEVBQUUsbUJBQW1CLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBYSxRQUFRLEdBQUcsTUFBTSxXQUFXLENBQUM7QUFDbEgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUU5QyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7QUFFaEIsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQ3RCLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUV4QyxNQUFNLE9BQU8sS0FBTSxTQUFRLFdBQVc7SUEwQnBDLEtBQUssQ0FBQyxHQUFHO1FBQ1AsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDcEMsTUFBTSxFQUNKLE9BQU8sRUFBRSxVQUFVLEVBQ25CLFFBQVEsRUFBRSxXQUFXLEVBQ3JCLE1BQU0sRUFBRSxTQUFTLEVBQ2pCLE9BQU8sRUFDUCxRQUFRLEVBQ1IsU0FBUyxFQUNULEtBQUssRUFD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
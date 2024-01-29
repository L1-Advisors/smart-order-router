"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quote = void 0;
const logger_1 = require("@ethersproject/logger");
const command_1 = require("@oclif/command");
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const dotenv_1 = __importDefault(require("dotenv"));
const lodash_1 = __importDefault(require("lodash"));
const src_1 = require("../../src");
const util_1 = require("../../src/util");
const base_command_1 = require("../base-command");
dotenv_1.default.config();
logger_1.Logger.globalLogger();
logger_1.Logger.setLogLevel(logger_1.Logger.levels.DEBUG);
class Quote extends base_command_1.BaseCommand {
    async run() {
        const { flags } = this.parse(Quote);
        const { tokenIn: tokenInStr, tokenOut: tokenOutStr, amount: amountStr, exactIn, exactOut, recipient, debug, topN, topNTokenInOut, topNSecondHop, topNSecondHopForTokenAddressRaw, topNWithEachBaseToken, topNWithBaseToken, topNWithBaseTokenInSet, topNDirectSwaps, maxSwapsPerPath, minSplits, maxSplits, distributionPercent, chainId: chainIdNumb, protocols: protocolsStr, forceCrossProtocol, forceMixedRoutes, simulate, debugRouting, enableFeeOnTransferFeeFetching, requestBlockNumber, gasToken } = flags;
        const topNSecondHopForTokenAddress = new src_1.MapWithLowerCaseKey();
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
                protocols = lodash_1.default.map(protocolsStr.split(','), (protocolStr) => (0, util_1.TO_PROTOCOL)(protocolStr));
            }
            catch (err) {
                throw new Error(`Protocols invalid. Valid options: ${Object.values(router_sdk_1.Protocol)}`);
            }
        }
        const chainId = (0, src_1.ID_TO_CHAIN_ID)(chainIdNumb);
        const log = this.logger;
        const tokenProvider = this.tokenProvider;
        const router = this.router;
        // if the tokenIn str is 'ETH' or 'MATIC' or in NATIVE_NAMES_BY_ID
        const tokenIn = util_1.NATIVE_NAMES_BY_ID[chainId].includes(tokenInStr)
            ? (0, src_1.nativeOnChain)(chainId)
            : (await tokenProvider.getTokens([tokenInStr])).getTokenByAddress(tokenInStr);
        const tokenOut = util_1.NATIVE_NAMES_BY_ID[chainId].includes(tokenOutStr)
            ? (0, src_1.nativeOnChain)(chainId)
            : (await tokenProvider.getTokens([tokenOutStr])).getTokenByAddress(tokenOutStr);
        let swapRoutes;
        if (exactIn) {
            const amountIn = (0, src_1.parseAmount)(amountStr, tokenIn);
            swapRoutes = await router.route(amountIn, tokenOut, sdk_core_1.TradeType.EXACT_INPUT, recipient
                ? {
                    type: src_1.SwapType.UNIVERSAL_ROUTER,
                    deadlineOrPreviousBlockhash: 10000000000000,
                    recipient,
                    slippageTolerance: new sdk_core_1.Percent(5, 100),
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
            const amountOut = (0, src_1.parseAmount)(amountStr, tokenOut);
            swapRoutes = await router.route(amountOut, tokenIn, sdk_core_1.TradeType.EXACT_OUTPUT, recipient
                ? {
                    type: src_1.SwapType.SWAP_ROUTER_02,
                    deadline: 100,
                    recipient,
                    slippageTolerance: new sdk_core_1.Percent(5, 10000),
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
exports.Quote = Quote;
Quote.description = 'Uniswap Smart Order Router CLI';
Quote.flags = Object.assign(Object.assign({}, base_command_1.BaseCommand.flags), { version: command_1.flags.version({ char: 'v' }), help: command_1.flags.help({ char: 'h' }), tokenIn: command_1.flags.string({ char: 'i', required: true }), tokenOut: command_1.flags.string({ char: 'o', required: true }), recipient: command_1.flags.string({ required: false }), amount: command_1.flags.string({ char: 'a', required: true }), exactIn: command_1.flags.boolean({ required: false }), exactOut: command_1.flags.boolean({ required: false }), protocols: command_1.flags.string({ required: false }), forceCrossProtocol: command_1.flags.boolean({ required: false, default: false }), forceMixedRoutes: command_1.flags.boolean({
        required: false,
        default: false,
    }), simulate: command_1.flags.boolean({ required: false, default: false }), debugRouting: command_1.flags.boolean({ required: false, default: true }), enableFeeOnTransferFeeFetching: command_1.flags.boolean({ required: false, default: false }), requestBlockNumber: command_1.flags.integer({ required: false }), gasToken: command_1.flags.string({ required: false }) });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jbGkvY29tbWFuZHMvcXVvdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsa0RBQStDO0FBQy9DLDRDQUF1QztBQUN2QyxvREFBK0M7QUFDL0MsZ0RBQWlFO0FBQ2pFLG9EQUE0QjtBQUM1QixvREFBdUI7QUFFdkIsbUNBQWtIO0FBQ2xILHlDQUFpRTtBQUNqRSxrREFBOEM7QUFFOUMsZ0JBQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUVoQixlQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7QUFDdEIsZUFBTSxDQUFDLFdBQVcsQ0FBQyxlQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRXhDLE1BQWEsS0FBTSxTQUFRLDBCQUFXO0lBMEJwQyxLQUFLLENBQUMsR0FBRztRQUNQLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLE1BQU0sRUFDSixPQUFPLEVBQUUsVUFBVSxFQUNuQixRQUFRLEVBQUUsV0FBVyxFQUNyQixNQUFNLEVBQUUsU0FBUyxFQUNqQixPQUFPLEVBQ1AsUUFBUSxFQUNSLFNBQVMsRUFDVCxLQUFLLEVBQ0wsSUFBSSxFQUNKLGNBQWMsRUFDZCxhQUFhLEVBQ2IsK0JBQStCLEVBQy9CLHFCQUFxQixFQUNyQixpQkFBaUIsRUFDakIsc0JBQXNCLEVBQ3RCLGVBQWUsRUFDZixlQUFlLEVBQ2YsU0FBUyxFQUNULFNBQVMsRUFDVCxtQkFBbUIsRUFDbkIsT0FBTyxFQUFFLFdBQVcsRUFDcEIsU0FBUyxFQUFFLFlBQVksRUFDdkIsa0JBQWtCLEVBQ2xCLGdCQUFnQixFQUNoQixRQUFRLEVBQ1IsWUFBWSxFQUNaLDhCQUE4QixFQUM5QixrQkFBa0IsRUFDbEIsUUFBUSxFQUNULEdBQUcsS0FBSyxDQUFDO1FBRVYsTUFBTSw0QkFBNEIsR0FBRyxJQUFJLHlC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
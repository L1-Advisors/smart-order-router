"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCommand = void 0;
/// <reference types="./types/bunyan-debug-stream" />
const bignumber_1 = require("@ethersproject/bignumber");
const providers_1 = require("@ethersproject/providers");
const command_1 = require("@oclif/command");
const default_token_list_1 = __importDefault(require("@uniswap/default-token-list"));
const sdk_core_1 = require("@uniswap/sdk-core");
const bunyan_1 = __importDefault(require("bunyan"));
const bunyan_debug_stream_1 = __importDefault(require("bunyan-debug-stream"));
const lodash_1 = __importDefault(require("lodash"));
const node_cache_1 = __importDefault(require("node-cache"));
const src_1 = require("../src");
const legacy_gas_price_provider_1 = require("../src/providers/legacy-gas-price-provider");
const on_chain_gas_price_provider_1 = require("../src/providers/on-chain-gas-price-provider");
const portion_provider_1 = require("../src/providers/portion-provider");
const token_fee_fetcher_1 = require("../src/providers/token-fee-fetcher");
class BaseCommand extends command_1.Command {
    constructor() {
        super(...arguments);
        this._log = null;
        this._router = null;
        this._swapToRatioRouter = null;
        this._tokenProvider = null;
        this._poolProvider = null;
        this._blockNumber = null;
        this._multicall2Provider = null;
    }
    get logger() {
        return this._log
            ? this._log
            : bunyan_1.default.createLogger({
                name: 'Default Logger',
            });
    }
    get router() {
        if (this._router) {
            return this._router;
        }
        else {
            throw 'router not initialized';
        }
    }
    get swapToRatioRouter() {
        if (this._swapToRatioRouter) {
            return this._swapToRatioRouter;
        }
        else {
            throw 'swapToRatioRouter not initialized';
        }
    }
    get tokenProvider() {
        if (this._tokenProvider) {
            return this._tokenProvider;
        }
        else {
            throw 'tokenProvider not initialized';
        }
    }
    get poolProvider() {
        if (this._poolProvider) {
            return this._poolProvider;
        }
        else {
            throw 'poolProvider not initialized';
        }
    }
    get blockNumber() {
        if (this._blockNumber) {
            return this._blockNumber;
        }
        else {
            throw 'blockNumber not initialized';
        }
    }
    get multicall2Provider() {
        if (this._multicall2Provider) {
            return this._multicall2Provider;
        }
        else {
            throw 'multicall2 not initialized';
        }
    }
    async init() {
        const query = this.parse();
        const { chainId: chainIdNumb, router: routerStr, debug, debugJSON, tokenListURI, } = query.flags;
        // initialize logger
        const logLevel = debug || debugJSON ? bunyan_1.default.DEBUG : bunyan_1.default.INFO;
        this._log = bunyan_1.default.createLogger({
            name: 'Uniswap Smart Order Router',
            serializers: bunyan_1.default.stdSerializers,
            level: logLevel,
            streams: debugJSON
                ? undefined
                : [
                    {
                        level: logLevel,
                        type: 'stream',
                        stream: (0, bunyan_debug_stream_1.default)({
                            basepath: __dirname,
                            forceColor: false,
                            showDate: false,
                            showPid: false,
                            showLoggerName: false,
                            showLevel: !!debug,
                        }),
                    },
                ],
        });
        if (debug || debugJSON) {
            (0, src_1.setGlobalLogger)(this.logger);
        }
        const chainId = (0, src_1.ID_TO_CHAIN_ID)(chainIdNumb);
        const chainProvider = (0, src_1.ID_TO_PROVIDER)(chainId);
        const metricLogger = new src_1.MetricLogger({
            chainId: chainIdNumb,
            networkName: (0, src_1.ID_TO_NETWORK_NAME)(chainId),
        });
        (0, src_1.setGlobalMetric)(metricLogger);
        const provider = new providers_1.JsonRpcProvider(chainProvider, chainId);
        this._blockNumber = await provider.getBlockNumber();
        const tokenCache = new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 3600, useClones: false }));
        let tokenListProvider;
        if (tokenListURI) {
            tokenListProvider = await src_1.CachingTokenListProvider.fromTokenListURI(chainId, tokenListURI, tokenCache);
        }
        else {
            tokenListProvider = await src_1.CachingTokenListProvider.fromTokenList(chainId, default_token_list_1.default, tokenCache);
        }
        const multicall2Provider = new src_1.UniswapMulticallProvider(chainId, provider);
        this._multicall2Provider = multicall2Provider;
        this._poolProvider = new src_1.V3PoolProvider(chainId, multicall2Provider);
        // initialize tokenProvider
        const tokenProviderOnChain = new src_1.TokenProvider(chainId, multicall2Provider);
        this._tokenProvider = new src_1.CachingTokenProviderWithFallback(chainId, tokenCache, tokenListProvider, tokenProviderOnChain);
        if (routerStr == 'legacy') {
            this._router = new src_1.LegacyRouter({
                chainId,
                multicall2Provider,
                poolProvider: new src_1.V3PoolProvider(chainId, multicall2Provider),
                quoteProvider: new src_1.OnChainQuoteProvider(chainId, provider, multicall2Provider),
                tokenProvider: this.tokenProvider,
            });
        }
        else {
            const gasPriceCache = new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 15, useClones: true }));
            const v3PoolProvider = new src_1.CachingV3PoolProvider(chainId, new src_1.V3PoolProvider(chainId, multicall2Provider), new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 360, useClones: false })));
            const tokenFeeFetcher = new token_fee_fetcher_1.OnChainTokenFeeFetcher(chainId, provider);
            const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(chainId, new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 360, useClones: false })), tokenFeeFetcher);
            const v2PoolProvider = new src_1.V2PoolProvider(chainId, multicall2Provider, tokenPropertiesProvider);
            const portionProvider = new portion_provider_1.PortionProvider();
            const tenderlySimulator = new src_1.TenderlySimulator(chainId, 'https://api.tenderly.co', process.env.TENDERLY_USER, process.env.TENDERLY_PROJECT, process.env.TENDERLY_ACCESS_KEY, v2PoolProvider, v3PoolProvider, provider, portionProvider, { [sdk_core_1.ChainId.ARBITRUM_ONE]: 1 });
            const ethEstimateGasSimulator = new src_1.EthEstimateGasSimulator(chainId, provider, v2PoolProvider, v3PoolProvider, portionProvider);
            const simulator = new src_1.FallbackTenderlySimulator(chainId, provider, portionProvider, tenderlySimulator, ethEstimateGasSimulator);
            const router = new src_1.AlphaRouter({
                provider,
                chainId,
                multicall2Provider: multicall2Provider,
                gasPriceProvider: new src_1.CachingGasStationProvider(chainId, new on_chain_gas_price_provider_1.OnChainGasPriceProvider(chainId, new src_1.EIP1559GasPriceProvider(provider), new legacy_gas_price_provider_1.LegacyGasPriceProvider(provider)), gasPriceCache),
                simulator,
            });
            this._swapToRatioRouter = router;
            this._router = router;
        }
    }
    logSwapResults(routeAmounts, quote, quoteGasAdjusted, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, methodParameters, blockNumber, estimatedGasUsed, gasPriceWei, simulationStatus) {
        this.logger.info(`Best Route:`);
        this.logger.info(`${(0, src_1.routeAmountsToString)(routeAmounts)}`);
        this.logger.info(`\tRaw Quote Exact In:`);
        this.logger.info(`\t\t${quote.toFixed(Math.min(quote.currency.decimals, 2))}`);
        this.logger.info(`\tGas Adjusted Quote In:`);
        this.logger.info(`\t\t${quoteGasAdjusted.toFixed(Math.min(quoteGasAdjusted.currency.decimals, 2))}`);
        this.logger.info(``);
        this.logger.info(`Gas Used Quote Token: ${estimatedGasUsedQuoteToken.toFixed(Math.min(estimatedGasUsedQuoteToken.currency.decimals, 6))}`);
        this.logger.info(`Gas Used USD: ${estimatedGasUsedUSD.toFixed(Math.min(estimatedGasUsedUSD.currency.decimals, 6))}`);
        if (estimatedGasUsedGasToken) {
            this.logger.info(`Gas Used gas token: ${estimatedGasUsedGasToken.toFixed(Math.min(estimatedGasUsedGasToken.currency.decimals, 6))}`);
        }
        this.logger.info(`Calldata: ${methodParameters === null || methodParameters === void 0 ? void 0 : methodParameters.calldata}`);
        this.logger.info(`Value: ${methodParameters === null || methodParameters === void 0 ? void 0 : methodParameters.value}`);
        this.logger.info({
            blockNumber: blockNumber.toString(),
            estimatedGasUsed: estimatedGasUsed.toString(),
            gasPriceWei: gasPriceWei.toString(),
            simulationStatus: simulationStatus,
        });
        const v3Routes = routeAmounts;
        let total = bignumber_1.BigNumber.from(0);
        for (let i = 0; i < v3Routes.length; i++) {
            const route = v3Routes[i];
            const tick = bignumber_1.BigNumber.from(Math.max(1, lodash_1.default.sum(route.initializedTicksCrossedList)));
            total = total.add(tick);
        }
        this.logger.info(`Total ticks crossed: ${total}`);
    }
}
exports.BaseCommand = BaseCommand;
BaseCommand.flags = {
    topN: command_1.flags.integer({
        required: false,
        default: 3,
    }),
    topNTokenInOut: command_1.flags.integer({
        required: false,
        default: 2,
    }),
    topNSecondHop: command_1.flags.integer({
        required: false,
        default: 2,
    }),
    topNSecondHopForTokenAddressRaw: command_1.flags.string({
        required: false,
        default: '',
    }),
    topNWithEachBaseToken: command_1.flags.integer({
        required: false,
        default: 2,
    }),
    topNWithBaseToken: command_1.flags.integer({
        required: false,
        default: 6,
    }),
    topNWithBaseTokenInSet: command_1.flags.boolean({
        required: false,
        default: false,
    }),
    topNDirectSwaps: command_1.flags.integer({
        required: false,
        default: 2,
    }),
    maxSwapsPerPath: command_1.flags.integer({
        required: false,
        default: 3,
    }),
    minSplits: command_1.flags.integer({
        required: false,
        default: 1,
    }),
    maxSplits: command_1.flags.integer({
        required: false,
        default: 3,
    }),
    distributionPercent: command_1.flags.integer({
        required: false,
        default: 5,
    }),
    chainId: command_1.flags.integer({
        char: 'c',
        required: false,
        default: sdk_core_1.ChainId.MAINNET,
        options: src_1.CHAIN_IDS_LIST,
    }),
    tokenListURI: command_1.flags.string({
        required: false,
    }),
    router: command_1.flags.string({
        char: 's',
        required: false,
        default: 'alpha',
    }),
    debug: command_1.flags.boolean(),
    debugJSON: command_1.flags.boolean(),
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1jb21tYW5kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vY2xpL2Jhc2UtY29tbWFuZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxxREFBcUQ7QUFDckQsd0RBQXFEO0FBQ3JELHdEQUEyRDtBQUMzRCw0Q0FBZ0Q7QUFFaEQscUZBQTZEO0FBQzdELGdEQUE2RTtBQUU3RSxvREFBbUQ7QUFDbkQsOEVBQW9EO0FBQ3BELG9EQUF1QjtBQUN2Qiw0REFBbUM7QUFFbkMsZ0NBa0NnQjtBQUNoQiwwRkFBb0Y7QUFDcEYsOEZBQXVGO0FBQ3ZGLHdFQUFvRTtBQUNwRSwwRUFBNEU7QUFFNUUsTUFBc0IsV0FBWSxTQUFRLGlCQUFPO0lBQWpEOztRQW9FVSxTQUFJLEdBQWtCLElBQUksQ0FBQztRQUMzQixZQUFPLEdBQXdCLElBQUksQ0FBQztRQUNwQyx1QkFBa0IsR0FBa0MsSUFBSSxDQUFDO1FBQ3pELG1CQUFjLEdBQTBCLElBQUksQ0FBQztRQUM3QyxrQkFBYSxHQUEyQixJQUFJLENBQUM7UUFDN0MsaUJBQVksR0FBa0IsSUFBSSxDQUFDO1FBQ25DLHdCQUFtQixHQUFvQyxJQUFJLENBQUM7SUFpU3RFLENBQUM7SUEvUkMsSUFBSSxNQUFNO1FBQ1IsT0FBTyxJQUFJLENBQUMsSUFBSTtZQUNkLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUNYLENBQUMsQ0FBQyxnQkFBTSxDQUFDLFlBQVksQ0FBQztnQkFDcEIsSUFBSSxFQUFFLGdCQUFnQjthQUN2QixDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1IsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztTQUNyQjthQUFNO1lBQ0wsTUFBTSx3QkFBd0IsQ0FBQztTQUNoQztJQUNILENBQUM7SUFFRCxJQUFJLGlCQUFpQjtRQUNuQixJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtZQUMz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
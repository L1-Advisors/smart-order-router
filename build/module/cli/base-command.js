/// <reference types="./types/bunyan-debug-stream" />
import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Command, flags } from '@oclif/command';
import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { ChainId } from '@uniswap/sdk-core';
import bunyan from 'bunyan';
import bunyanDebugStream from 'bunyan-debug-stream';
import _ from 'lodash';
import NodeCache from 'node-cache';
import { AlphaRouter, CachingGasStationProvider, CachingTokenListProvider, CachingTokenProviderWithFallback, CachingV3PoolProvider, CHAIN_IDS_LIST, EIP1559GasPriceProvider, EthEstimateGasSimulator, FallbackTenderlySimulator, ID_TO_CHAIN_ID, ID_TO_NETWORK_NAME, ID_TO_PROVIDER, LegacyRouter, MetricLogger, NodeJSCache, OnChainQuoteProvider, routeAmountsToString, setGlobalLogger, setGlobalMetric, TenderlySimulator, TokenPropertiesProvider, TokenProvider, UniswapMulticallProvider, V2PoolProvider, V3PoolProvider, } from '../src';
import { LegacyGasPriceProvider } from '../src/providers/legacy-gas-price-provider';
import { OnChainGasPriceProvider } from '../src/providers/on-chain-gas-price-provider';
import { PortionProvider } from '../src/providers/portion-provider';
import { OnChainTokenFeeFetcher } from '../src/providers/token-fee-fetcher';
export class BaseCommand extends Command {
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
            : bunyan.createLogger({
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
        const logLevel = debug || debugJSON ? bunyan.DEBUG : bunyan.INFO;
        this._log = bunyan.createLogger({
            name: 'Uniswap Smart Order Router',
            serializers: bunyan.stdSerializers,
            level: logLevel,
            streams: debugJSON
                ? undefined
                : [
                    {
                        level: logLevel,
                        type: 'stream',
                        stream: bunyanDebugStream({
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
            setGlobalLogger(this.logger);
        }
        const chainId = ID_TO_CHAIN_ID(chainIdNumb);
        const chainProvider = ID_TO_PROVIDER(chainId);
        const metricLogger = new MetricLogger({
            chainId: chainIdNumb,
            networkName: ID_TO_NETWORK_NAME(chainId),
        });
        setGlobalMetric(metricLogger);
        const provider = new JsonRpcProvider(chainProvider, chainId);
        this._blockNumber = await provider.getBlockNumber();
        const tokenCache = new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }));
        let tokenListProvider;
        if (tokenListURI) {
            tokenListProvider = await CachingTokenListProvider.fromTokenListURI(chainId, tokenListURI, tokenCache);
        }
        else {
            tokenListProvider = await CachingTokenListProvider.fromTokenList(chainId, DEFAULT_TOKEN_LIST, tokenCache);
        }
        const multicall2Provider = new UniswapMulticallProvider(chainId, provider);
        this._multicall2Provider = multicall2Provider;
        this._poolProvider = new V3PoolProvider(chainId, multicall2Provider);
        // initialize tokenProvider
        const tokenProviderOnChain = new TokenProvider(chainId, multicall2Provider);
        this._tokenProvider = new CachingTokenProviderWithFallback(chainId, tokenCache, tokenListProvider, tokenProviderOnChain);
        if (routerStr == 'legacy') {
            this._router = new LegacyRouter({
                chainId,
                multicall2Provider,
                poolProvider: new V3PoolProvider(chainId, multicall2Provider),
                quoteProvider: new OnChainQuoteProvider(chainId, provider, multicall2Provider),
                tokenProvider: this.tokenProvider,
            });
        }
        else {
            const gasPriceCache = new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: true }));
            const v3PoolProvider = new CachingV3PoolProvider(chainId, new V3PoolProvider(chainId, multicall2Provider), new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })));
            const tokenFeeFetcher = new OnChainTokenFeeFetcher(chainId, provider);
            const tokenPropertiesProvider = new TokenPropertiesProvider(chainId, new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })), tokenFeeFetcher);
            const v2PoolProvider = new V2PoolProvider(chainId, multicall2Provider, tokenPropertiesProvider);
            const portionProvider = new PortionProvider();
            const tenderlySimulator = new TenderlySimulator(chainId, 'https://api.tenderly.co', process.env.TENDERLY_USER, process.env.TENDERLY_PROJECT, process.env.TENDERLY_ACCESS_KEY, v2PoolProvider, v3PoolProvider, provider, portionProvider, { [ChainId.ARBITRUM_ONE]: 1 });
            const ethEstimateGasSimulator = new EthEstimateGasSimulator(chainId, provider, v2PoolProvider, v3PoolProvider, portionProvider);
            const simulator = new FallbackTenderlySimulator(chainId, provider, portionProvider, tenderlySimulator, ethEstimateGasSimulator);
            const router = new AlphaRouter({
                provider,
                chainId,
                multicall2Provider: multicall2Provider,
                gasPriceProvider: new CachingGasStationProvider(chainId, new OnChainGasPriceProvider(chainId, new EIP1559GasPriceProvider(provider), new LegacyGasPriceProvider(provider)), gasPriceCache),
                simulator,
            });
            this._swapToRatioRouter = router;
            this._router = router;
        }
    }
    logSwapResults(routeAmounts, quote, quoteGasAdjusted, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, methodParameters, blockNumber, estimatedGasUsed, gasPriceWei, simulationStatus) {
        this.logger.info(`Best Route:`);
        this.logger.info(`${routeAmountsToString(routeAmounts)}`);
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
        let total = BigNumber.from(0);
        for (let i = 0; i < v3Routes.length; i++) {
            const route = v3Routes[i];
            const tick = BigNumber.from(Math.max(1, _.sum(route.initializedTicksCrossedList)));
            total = total.add(tick);
        }
        this.logger.info(`Total ticks crossed: ${total}`);
    }
}
BaseCommand.flags = {
    topN: flags.integer({
        required: false,
        default: 3,
    }),
    topNTokenInOut: flags.integer({
        required: false,
        default: 2,
    }),
    topNSecondHop: flags.integer({
        required: false,
        default: 2,
    }),
    topNSecondHopForTokenAddressRaw: flags.string({
        required: false,
        default: '',
    }),
    topNWithEachBaseToken: flags.integer({
        required: false,
        default: 2,
    }),
    topNWithBaseToken: flags.integer({
        required: false,
        default: 6,
    }),
    topNWithBaseTokenInSet: flags.boolean({
        required: false,
        default: false,
    }),
    topNDirectSwaps: flags.integer({
        required: false,
        default: 2,
    }),
    maxSwapsPerPath: flags.integer({
        required: false,
        default: 3,
    }),
    minSplits: flags.integer({
        required: false,
        default: 1,
    }),
    maxSplits: flags.integer({
        required: false,
        default: 3,
    }),
    distributionPercent: flags.integer({
        required: false,
        default: 5,
    }),
    chainId: flags.integer({
        char: 'c',
        required: false,
        default: ChainId.MAINNET,
        options: CHAIN_IDS_LIST,
    }),
    tokenListURI: flags.string({
        required: false,
    }),
    router: flags.string({
        char: 's',
        required: false,
        default: 'alpha',
    }),
    debug: flags.boolean(),
    debugJSON: flags.boolean(),
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1jb21tYW5kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vY2xpL2Jhc2UtY29tbWFuZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxxREFBcUQ7QUFDckQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRWhELE9BQU8sa0JBQWtCLE1BQU0sNkJBQTZCLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBbUMsTUFBTSxtQkFBbUIsQ0FBQztBQUU3RSxPQUFPLE1BQTZCLE1BQU0sUUFBUSxDQUFDO0FBQ25ELE9BQU8saUJBQWlCLE1BQU0scUJBQXFCLENBQUM7QUFDcEQsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBQ3ZCLE9BQU8sU0FBUyxNQUFNLFlBQVksQ0FBQztBQUVuQyxPQUFPLEVBQ0wsV0FBVyxFQUNYLHlCQUF5QixFQUN6Qix3QkFBd0IsRUFDeEIsZ0NBQWdDLEVBQ2hDLHFCQUFxQixFQUNyQixjQUFjLEVBQ2QsdUJBQXVCLEVBQ3ZCLHVCQUF1QixFQUN2Qix5QkFBeUIsRUFFekIsY0FBYyxFQUNkLGtCQUFrQixFQUNsQixjQUFjLEVBS2QsWUFBWSxFQUNaLFlBQVksRUFDWixXQUFXLEVBQ1gsb0JBQW9CLEVBQ3BCLG9CQUFvQixFQUVwQixlQUFlLEVBQ2YsZUFBZSxFQUVmLGlCQUFpQixFQUNqQix1QkFBdUIsRUFDdkIsYUFBYSxFQUNiLHdCQUF3QixFQUN4QixjQUFjLEVBQ2QsY0FBYyxHQUVmLE1BQU0sUUFBUSxDQUFDO0FBQ2hCLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3ZGLE9BQU8s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
import http from 'http';
import https from 'https';
import { MaxUint256 } from '@ethersproject/constants';
import { ChainId } from '@uniswap/sdk-core';
import { UNIVERSAL_ROUTER_ADDRESS, } from '@uniswap/universal-router-sdk';
import axios from 'axios';
import { BigNumber } from 'ethers/lib/ethers';
import { metric, MetricLoggerUnit, SwapType, } from '../routers';
import { Erc20__factory } from '../types/other/factories/Erc20__factory';
import { Permit2__factory } from '../types/other/factories/Permit2__factory';
import { BEACON_CHAIN_DEPOSIT_ADDRESS, log, MAX_UINT160, SWAP_ROUTER_02_ADDRESSES, } from '../util';
import { APPROVE_TOKEN_FOR_TRANSFER } from '../util/callData';
import { calculateGasUsed, initSwapRouteFromExisting, } from '../util/gas-factory-helpers';
import { SimulationStatus, Simulator, } from './simulation-provider';
import { permit2Address } from '@uniswap/permit2-sdk';
var TenderlySimulationType;
(function (TenderlySimulationType) {
    TenderlySimulationType["QUICK"] = "quick";
    TenderlySimulationType["FULL"] = "full";
    TenderlySimulationType["ABI"] = "abi";
})(TenderlySimulationType || (TenderlySimulationType = {}));
const TENDERLY_BATCH_SIMULATE_API = (tenderlyBaseUrl, tenderlyUser, tenderlyProject) => `${tenderlyBaseUrl}/api/v1/account/${tenderlyUser}/project/${tenderlyProject}/simulate-batch`;
const TENDERLY_NODE_API = (chainId, tenderlyNodeApiKey) => {
    switch (chainId) {
        case ChainId.MAINNET:
            return `https://mainnet.gateway.tenderly.co/${tenderlyNodeApiKey}`;
        default:
            throw new Error(`ChainId ${chainId} does not correspond to a tenderly node endpoint`);
    }
};
// We multiply tenderly gas limit by this to overestimate gas limit
const DEFAULT_ESTIMATE_MULTIPLIER = 1.3;
export class FallbackTenderlySimulator extends Simulator {
    constructor(chainId, provider, portionProvider, tenderlySimulator, ethEstimateGasSimulator) {
        super(provider, portionProvider, chainId);
        this.tenderlySimulator = tenderlySimulator;
        this.ethEstimateGasSimulator = ethEstimateGasSimulator;
    }
    async simulateTransaction(fromAddress, swapOptions, swapRoute, providerConfig) {
        // Make call to eth estimate gas if possible
        // For erc20s, we must check if the token allowance is sufficient
        const inputAmount = swapRoute.trade.inputAmount;
        if ((inputAmount.currency.isNative && this.chainId == ChainId.MAINNET) ||
            (await this.checkTokenApproved(fromAddress, inputAmount, swapOptions, this.provider))) {
            log.info('Simulating with eth_estimateGas since token is native or approved.');
            try {
                const swapRouteWithGasEstimate = await this.ethEstimateGasSimulator.ethEstimateGas(fromAddress, swapOptions, swapRoute, providerConfig);
                return swapRouteWithGasEstimate;
            }
            catch (err) {
                log.info({ err: err }, 'Error simulating using eth_estimateGas');
                return { ...swapRoute, simulationStatus: SimulationStatus.Failed };
            }
        }
        try {
            return await this.tenderlySimulator.simulateTransaction(fromAddress, swapOptions, swapRoute, providerConfig);
        }
        catch (err) {
            log.error({ err: err }, 'Failed to simulate via Tenderly');
            if (err instanceof Error && err.message.includes('timeout')) {
                metric.putMetric('TenderlySimulationTimeouts', 1, MetricLoggerUnit.Count);
            }
            return { ...swapRoute, simulationStatus: SimulationStatus.Failed };
        }
    }
}
export class TenderlySimulator extends Simulator {
    constructor(chainId, tenderlyBaseUrl, tenderlyUser, tenderlyProject, tenderlyAccessKey, tenderlyNodeApiKey, v2PoolProvider, v3PoolProvider, provider, portionProvider, overrideEstimateMultiplier, tenderlyRequestTimeout, tenderlyNodeApiSamplingPercent, tenderlyNodeApiEnabledChains) {
        super(provider, portionProvider, chainId);
        this.tenderlyNodeApiEnabledChains = [];
        this.tenderlyServiceInstance = axios.create({
            // keep connections alive,
            // maxSockets default is Infinity, so Infinity is read as 50 sockets
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
        });
        this.tenderlyBaseUrl = tenderlyBaseUrl;
        this.tenderlyUser = tenderlyUser;
        this.tenderlyProject = tenderlyProject;
        this.tenderlyAccessKey = tenderlyAccessKey;
        this.tenderlyNodeApiKey = tenderlyNodeApiKey;
        this.v2PoolProvider = v2PoolProvider;
        this.v3PoolProvider = v3PoolProvider;
        this.overrideEstimateMultiplier = overrideEstimateMultiplier !== null && overrideEstimateMultiplier !== void 0 ? overrideEstimateMultiplier : {};
        this.tenderlyRequestTimeout = tenderlyRequestTimeout;
        this.tenderlyNodeApiSamplingPercent = tenderlyNodeApiSamplingPercent;
        this.tenderlyNodeApiEnabledChains = tenderlyNodeApiEnabledChains;
    }
    async simulateTransaction(fromAddress, swapOptions, swapRoute, providerConfig) {
        var _a;
        const currencyIn = swapRoute.trade.inputAmount.currency;
        const tokenIn = currencyIn.wrapped;
        const chainId = this.chainId;
        if ([ChainId.CELO, ChainId.CELO_ALFAJORES].includes(chainId)) {
            const msg = 'Celo not supported by Tenderly!';
            log.info(msg);
            return { ...swapRoute, simulationStatus: SimulationStatus.NotSupported };
        }
        if (!swapRoute.methodParameters) {
            const msg = 'No calldata provided to simulate transaction';
            log.info(msg);
            throw new Error(msg);
        }
        const { calldata } = swapRoute.methodParameters;
        log.info({
            calldata: swapRoute.methodParameters.calldata,
            fromAddress: fromAddress,
            chainId: chainId,
            tokenInAddress: tokenIn.address,
            router: swapOptions.type,
        }, 'Simulating transaction on Tenderly');
        const blockNumber = await (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber);
        let estimatedGasUsed;
        const estimateMultiplier = (_a = this.overrideEstimateMultiplier[chainId]) !== null && _a !== void 0 ? _a : DEFAULT_ESTIMATE_MULTIPLIER;
        if (swapOptions.type == SwapType.UNIVERSAL_ROUTER) {
            // simulating from beacon chain deposit address that should always hold **enough balance**
            if (currencyIn.isNative && this.chainId == ChainId.MAINNET) {
                fromAddress = BEACON_CHAIN_DEPOSIT_ADDRESS;
            }
            // Do initial onboarding approval of Permit2.
            const erc20Interface = Erc20__factory.createInterface();
            const approvePermit2Calldata = erc20Interface.encodeFunctionData('approve', [permit2Address(this.chainId), MaxUint256]);
            // We are unsure if the users calldata contains a permit or not. We just
            // max approve the Universal Router from Permit2 instead, which will cover both cases.
            const permit2Interface = Permit2__factory.createInterface();
            const approveUniversalRouterCallData = permit2Interface.encodeFunctionData('approve', [
                tokenIn.address,
                UNIVERSAL_ROUTER_ADDRESS(this.chainId),
                MAX_UINT160,
                Math.floor(new Date().getTime() / 1000) + 10000000,
            ]);
            const approvePermit2 = {
                network_id: chainId,
                estimate_gas: true,
                input: approvePermit2Calldata,
                to: tokenIn.address,
                value: '0',
                from: fromAddress,
                simulation_type: TenderlySimulationType.QUICK,
                save_if_fails: providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.saveTenderlySimulationIfFailed,
            };
            const approveUniversalRouter = {
                network_id: chainId,
                estimate_gas: true,
                input: approveUniversalRouterCallData,
                to: permit2Address(this.chainId),
                value: '0',
                from: fromAddress,
                simulation_type: TenderlySimulationType.QUICK,
                save_if_fails: providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.saveTenderlySimulationIfFailed,
            };
            const swap = {
                network_id: chainId,
                input: calldata,
                estimate_gas: true,
                to: UNIVERSAL_ROUTER_ADDRESS(this.chainId),
                value: currencyIn.isNative ? swapRoute.methodParameters.value : '0',
                from: fromAddress,
                block_number: blockNumber,
                simulation_type: TenderlySimulationType.QUICK,
                save_if_fails: providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.saveTenderlySimulationIfFailed,
            };
            const body = {
                simulations: [approvePermit2, approveUniversalRouter, swap],
                estimate_gas: true,
            };
            const opts = {
                headers: {
                    'X-Access-Key': this.tenderlyAccessKey,
                },
                timeout: this.tenderlyRequestTimeout,
            };
            const url = TENDERLY_BATCH_SIMULATE_API(this.tenderlyBaseUrl, this.tenderlyUser, this.tenderlyProject);
            metric.putMetric('TenderlySimulationUniversalRouterRequests', 1, MetricLoggerUnit.Count);
            const before = Date.now();
            const { data: resp, status: httpStatus } = await this.tenderlyServiceInstance
                .post(url, body, opts)
                .finally(() => {
                metric.putMetric('TenderlySimulationLatencies', Date.now() - before, MetricLoggerUnit.Milliseconds);
            });
            // fire tenderly node endpoint sampling and forget
            this.sampleNodeEndpoint(approvePermit2, approveUniversalRouter, swap, resp);
            const latencies = Date.now() - before;
            log.info(`Tenderly simulation universal router request body: ${JSON.stringify(body, null, 2)} with result ${JSON.stringify(resp, null, 2)}, having latencies ${latencies} in milliseconds.`);
            metric.putMetric('TenderlySimulationUniversalRouterLatencies', Date.now() - before, MetricLoggerUnit.Milliseconds);
            metric.putMetric(`TenderlySimulationUniversalRouterResponseStatus${httpStatus}`, 1, MetricLoggerUnit.Count);
            // Validate tenderly response body
            if (!resp ||
                resp.simulation_results.length < 3 ||
                !resp.simulation_results[2].transaction ||
                resp.simulation_results[2].transaction.error_message) {
                this.logTenderlyErrorResponse(resp);
                return { ...swapRoute, simulationStatus: SimulationStatus.Failed };
            }
            // Parse the gas used in the simulation response object, and then pad it so that we overestimate.
            estimatedGasUsed = BigNumber.from((resp.simulation_results[2].transaction.gas * estimateMultiplier).toFixed(0));
            log.info({
                body,
                approvePermit2GasUsed: resp.simulation_results[0].transaction.gas_used,
                approveUniversalRouterGasUsed: resp.simulation_results[1].transaction.gas_used,
                swapGasUsed: resp.simulation_results[2].transaction.gas_used,
                approvePermit2Gas: resp.simulation_results[0].transaction.gas,
                approveUniversalRouterGas: resp.simulation_results[1].transaction.gas,
                swapGas: resp.simulation_results[2].transaction.gas,
                swapWithMultiplier: estimatedGasUsed.toString(),
            }, 'Successfully Simulated Approvals + Swap via Tenderly for Universal Router. Gas used.');
            log.info({
                body,
                swapSimulation: resp.simulation_results[2].simulation,
                swapTransaction: resp.simulation_results[2].transaction,
            }, 'Successful Tenderly Swap Simulation for Universal Router');
        }
        else if (swapOptions.type == SwapType.SWAP_ROUTER_02) {
            const approve = {
                network_id: chainId,
                input: APPROVE_TOKEN_FOR_TRANSFER,
                estimate_gas: true,
                to: tokenIn.address,
                value: '0',
                from: fromAddress,
                simulation_type: TenderlySimulationType.QUICK,
            };
            const swap = {
                network_id: chainId,
                input: calldata,
                to: SWAP_ROUTER_02_ADDRESSES(chainId),
                estimate_gas: true,
                value: currencyIn.isNative ? swapRoute.methodParameters.value : '0',
                from: fromAddress,
                block_number: blockNumber,
                simulation_type: TenderlySimulationType.QUICK,
            };
            const body = { simulations: [approve, swap] };
            const opts = {
                headers: {
                    'X-Access-Key': this.tenderlyAccessKey,
                },
                timeout: this.tenderlyRequestTimeout,
            };
            const url = TENDERLY_BATCH_SIMULATE_API(this.tenderlyBaseUrl, this.tenderlyUser, this.tenderlyProject);
            metric.putMetric('TenderlySimulationSwapRouter02Requests', 1, MetricLoggerUnit.Count);
            const before = Date.now();
            const { data: resp, status: httpStatus } = await this.tenderlyServiceInstance.post(url, body, opts);
            metric.putMetric(`TenderlySimulationSwapRouter02ResponseStatus${httpStatus}`, 1, MetricLoggerUnit.Count);
            const latencies = Date.now() - before;
            log.info(`Tenderly simulation swap router02 request body: ${body}, having latencies ${latencies} in milliseconds.`);
            metric.putMetric('TenderlySimulationSwapRouter02Latencies', latencies, MetricLoggerUnit.Milliseconds);
            // Validate tenderly response body
            if (!resp ||
                resp.simulation_results.length < 2 ||
                !resp.simulation_results[1].transaction ||
                resp.simulation_results[1].transaction.error_message) {
                const msg = `Failed to Simulate Via Tenderly!: ${resp.simulation_results[1].transaction.error_message}`;
                log.info({ err: resp.simulation_results[1].transaction.error_message }, msg);
                return { ...swapRoute, simulationStatus: SimulationStatus.Failed };
            }
            // Parse the gas used in the simulation response object, and then pad it so that we overestimate.
            estimatedGasUsed = BigNumber.from((resp.simulation_results[1].transaction.gas * estimateMultiplier).toFixed(0));
            log.info({
                body,
                approveGasUsed: resp.simulation_results[0].transaction.gas_used,
                swapGasUsed: resp.simulation_results[1].transaction.gas_used,
                approveGas: resp.simulation_results[0].transaction.gas,
                swapGas: resp.simulation_results[1].transaction.gas,
                swapWithMultiplier: estimatedGasUsed.toString(),
            }, 'Successfully Simulated Approval + Swap via Tenderly for SwapRouter02. Gas used.');
            log.info({
                body,
                swapTransaction: resp.simulation_results[1].transaction,
                swapSimulation: resp.simulation_results[1].simulation,
            }, 'Successful Tenderly Swap Simulation for SwapRouter02');
        }
        else {
            throw new Error(`Unsupported swap type: ${swapOptions}`);
        }
        const { estimatedGasUsedUSD, estimatedGasUsedQuoteToken, estimatedGasUsedGasToken, quoteGasAdjusted, } = await calculateGasUsed(chainId, swapRoute, estimatedGasUsed, this.v2PoolProvider, this.v3PoolProvider, this.provider, providerConfig);
        return {
            ...initSwapRouteFromExisting(swapRoute, this.v2PoolProvider, this.v3PoolProvider, this.portionProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, swapOptions, estimatedGasUsedGasToken),
            simulationStatus: SimulationStatus.Succeeded,
        };
    }
    logTenderlyErrorResponse(resp) {
        log.info({
            resp,
        }, 'Failed to Simulate on Tenderly');
        log.info({
            err: resp.simulation_results.length >= 1
                ? resp.simulation_results[0].transaction
                : {},
        }, 'Failed to Simulate on Tenderly #1 Transaction');
        log.info({
            err: resp.simulation_results.length >= 1
                ? resp.simulation_results[0].simulation
                : {},
        }, 'Failed to Simulate on Tenderly #1 Simulation');
        log.info({
            err: resp.simulation_results.length >= 2
                ? resp.simulation_results[1].transaction
                : {},
        }, 'Failed to Simulate on Tenderly #2 Transaction');
        log.info({
            err: resp.simulation_results.length >= 2
                ? resp.simulation_results[1].simulation
                : {},
        }, 'Failed to Simulate on Tenderly #2 Simulation');
        log.info({
            err: resp.simulation_results.length >= 3
                ? resp.simulation_results[2].transaction
                : {},
        }, 'Failed to Simulate on Tenderly #3 Transaction');
        log.info({
            err: resp.simulation_results.length >= 3
                ? resp.simulation_results[2].simulation
                : {},
        }, 'Failed to Simulate on Tenderly #3 Simulation');
    }
    async sampleNodeEndpoint(approvePermit2, approveUniversalRouter, swap, gatewayResp) {
        var _a, _b;
        if (Math.random() * 100 < ((_a = this.tenderlyNodeApiSamplingPercent) !== null && _a !== void 0 ? _a : 0) &&
            ((_b = this.tenderlyNodeApiEnabledChains) !== null && _b !== void 0 ? _b : []).find((chainId) => chainId === this.chainId)) {
            const nodeEndpoint = TENDERLY_NODE_API(this.chainId, this.tenderlyNodeApiKey);
            const body = {
                id: 1,
                jsonrpc: '2.0',
                method: 'tenderly_estimateGasBundle',
                params: [
                    [
                        {
                            from: approvePermit2.from,
                            to: approvePermit2.to,
                            data: approvePermit2.input,
                        },
                        {
                            from: approveUniversalRouter.from,
                            to: approveUniversalRouter.to,
                            data: approveUniversalRouter.input,
                        },
                        { from: swap.from, to: swap.to, data: swap.input },
                    ],
                    swap.block_number
                        ? BigNumber.from(swap.block_number)
                            .toHexString()
                            .replace('0x0', '0x')
                        : 'latest',
                ],
            };
            log.info(`About to invoke Tenderly Node Endpoint for gas estimation bundle ${JSON.stringify(body, null, 2)}.`);
            const before = Date.now();
            try {
                // For now, we don't timeout tenderly node endpoint, but we should before we live switch to node endpoint
                const { data: resp, status: httpStatus } = await this.tenderlyServiceInstance.post(nodeEndpoint, body);
                const latencies = Date.now() - before;
                metric.putMetric('TenderlyNodeGasEstimateBundleLatencies', latencies, MetricLoggerUnit.Milliseconds);
                metric.putMetric('TenderlyNodeGasEstimateBundleSuccess', 1, MetricLoggerUnit.Count);
                log.info(`Tenderly estimate gas bundle request body: ${JSON.stringify(body, null, 2)} with http status ${httpStatus} result ${JSON.stringify(resp, null, 2)}, having latencies ${latencies} in milliseconds.`);
                if (gatewayResp.simulation_results.length !== resp.result.length) {
                    metric.putMetric('TenderlyNodeGasEstimateBundleLengthMismatch', 1, MetricLoggerUnit.Count);
                    return;
                }
                let gasEstimateMismatch = false;
                for (let i = 0; i <
                    Math.min(gatewayResp.simulation_results.length, resp.result.length); i++) {
                    const gatewayGas = gatewayResp.simulation_results[i].transaction.gas;
                    const nodeGas = Number(resp.result[i].gas);
                    const gatewayGasUsed = gatewayResp.simulation_results[i].transaction.gas_used;
                    const nodeGasUsed = Number(resp.result[i].gasUsed);
                    if (gatewayGas !== nodeGas) {
                        log.error(`Gateway gas and node gas estimates do not match for index ${i}`, { gatewayGas, nodeGas });
                        metric.putMetric(`TenderlyNodeGasEstimateBundleGasMismatch${i}`, 1, MetricLoggerUnit.Count);
                        gasEstimateMismatch = true;
                    }
                    if (gatewayGasUsed !== nodeGasUsed) {
                        log.error(`Gateway gas and node gas used estimates do not match for index ${i}`, { gatewayGasUsed, nodeGasUsed });
                        metric.putMetric(`TenderlyNodeGasEstimateBundleGasUsedMismatch${i}`, 1, MetricLoggerUnit.Count);
                        gasEstimateMismatch = true;
                    }
                }
                if (!gasEstimateMismatch) {
                    metric.putMetric('TenderlyNodeGasEstimateBundleMatch', 1, MetricLoggerUnit.Count);
                }
            }
            catch (err) {
                log.error(`Failed to invoke Tenderly Node Endpoint for gas estimation bundle ${JSON.stringify(body, null, 2)}. Error: ${err}`);
                metric.putMetric('TenderlyNodeGasEstimateBundleFailure', 1, MetricLoggerUnit.Count);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVuZGVybHktc2ltdWxhdGlvbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdGVuZGVybHktc2ltdWxhdGlvbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLElBQUksTUFBTSxNQUFNLENBQUM7QUFDeEIsT0FBTyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBRTFCLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUV0RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDNUMsT0FBTyxFQUNMLHdCQUF3QixHQUN6QixNQUFNLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sS0FBNkIsTUFBTSxPQUFPLENBQUM7QUFDbEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRTlDLE9BQU8sRUFFTCxNQUFNLEVBQ04sZ0JBQWdCLEVBR2hCLFFBQVEsR0FDVCxNQUFNLFlBQVksQ0FBQztBQUNwQixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDN0UsT0FBTyxFQUNMLDRCQUE0QixFQUM1QixHQUFHLEVBQ0gsV0FBVyxFQUNYLHdCQUF3QixHQUN6QixNQUFNLFNBQVMsQ0FBQztBQUNqQixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUM5RCxPQUFPLEVBQ0wsZ0JBQWdCLEVBQ2hCLHlCQUF5QixHQUMxQixNQUFNLDZCQUE2QixDQUFDO0FBSXJDLE9BQU8sRUFFTCxnQkFBZ0IsRUFDaEIsU0FBUyxHQUNWLE1BQU0sdUJBQXVCLENBQUM7QUFHL0IsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBK0J0RCxJQUFLLHNCQUlKO0FBSkQsV0FBSyxzQkFBc0I7SUFD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
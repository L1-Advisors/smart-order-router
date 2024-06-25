import http from 'http';
import https from 'https';
import { MaxUint256 } from '@ethersproject/constants';
import { permit2Address } from '@uniswap/permit2-sdk';
import { ChainId } from '@uniswap/sdk-core';
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk';
import axios from 'axios';
import { BigNumber } from 'ethers/lib/ethers';
import { metric, MetricLoggerUnit, SwapType, } from '../routers';
import { Erc20__factory } from '../types/other/factories/Erc20__factory';
import { Permit2__factory } from '../types/other/factories/Permit2__factory';
import { BEACON_CHAIN_DEPOSIT_ADDRESS, log, MAX_UINT160, SWAP_ROUTER_02_ADDRESSES, } from '../util';
import { APPROVE_TOKEN_FOR_TRANSFER } from '../util/callData';
import { calculateGasUsed, initSwapRouteFromExisting, } from '../util/gas-factory-helpers';
import { SimulationStatus, Simulator, } from './simulation-provider';
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
export const TENDERLY_NOT_SUPPORTED_CHAINS = [
    ChainId.CELO,
    ChainId.CELO_ALFAJORES,
    ChainId.ZKSYNC,
];
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
        if (TENDERLY_NOT_SUPPORTED_CHAINS.includes(chainId)) {
            const msg = `${TENDERLY_NOT_SUPPORTED_CHAINS.toString()} not supported by Tenderly!`;
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
            this.sampleNodeEndpoint(approvePermit2, approveUniversalRouter, swap, body, resp);
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
    async sampleNodeEndpoint(approvePermit2, approveUniversalRouter, swap, gatewayReq, gatewayResp) {
        var _a, _b;
        if (Math.random() * 100 < ((_a = this.tenderlyNodeApiSamplingPercent) !== null && _a !== void 0 ? _a : 0) &&
            ((_b = this.tenderlyNodeApiEnabledChains) !== null && _b !== void 0 ? _b : []).find((chainId) => chainId === this.chainId)) {
            const nodeEndpoint = TENDERLY_NODE_API(this.chainId, this.tenderlyNodeApiKey);
            const blockNumber = swap.block_number
                ? BigNumber.from(swap.block_number).toHexString().replace('0x0', '0x')
                : 'latest';
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
                    blockNumber,
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
                        log.error(`Gateway gas and node gas estimates do not match for index ${i}`, { gatewayGas, nodeGas, blockNumber });
                        metric.putMetric(`TenderlyNodeGasEstimateBundleGasMismatch${i}`, 1, MetricLoggerUnit.Count);
                        gasEstimateMismatch = true;
                    }
                    if (gatewayGasUsed !== nodeGasUsed) {
                        log.error(`Gateway gas and node gas used estimates do not match for index ${i}`, { gatewayGas, nodeGas, blockNumber });
                        metric.putMetric(`TenderlyNodeGasEstimateBundleGasUsedMismatch${i}`, 1, MetricLoggerUnit.Count);
                        gasEstimateMismatch = true;
                    }
                }
                if (!gasEstimateMismatch) {
                    metric.putMetric('TenderlyNodeGasEstimateBundleMatch', 1, MetricLoggerUnit.Count);
                }
                else {
                    log.error(`Gateway gas and node gas estimates do not match
              gateway request body ${JSON.stringify(gatewayReq, null, 2)}
              node request body ${JSON.stringify(body, null, 2)}`);
                }
            }
            catch (err) {
                log.error(`Failed to invoke Tenderly Node Endpoint for gas estimation bundle ${JSON.stringify(body, null, 2)}. Error: ${err}`);
                metric.putMetric('TenderlyNodeGasEstimateBundleFailure', 1, MetricLoggerUnit.Count);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVuZGVybHktc2ltdWxhdGlvbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdGVuZGVybHktc2ltdWxhdGlvbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLElBQUksTUFBTSxNQUFNLENBQUM7QUFDeEIsT0FBTyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBRTFCLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUV0RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDdEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQzVDLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3pFLE9BQU8sS0FBNkIsTUFBTSxPQUFPLENBQUM7QUFDbEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRTlDLE9BQU8sRUFFTCxNQUFNLEVBQ04sZ0JBQWdCLEVBR2hCLFFBQVEsR0FDVCxNQUFNLFlBQVksQ0FBQztBQUNwQixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDN0UsT0FBTyxFQUNMLDRCQUE0QixFQUM1QixHQUFHLEVBQ0gsV0FBVyxFQUNYLHdCQUF3QixHQUN6QixNQUFNLFNBQVMsQ0FBQztBQUNqQixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUM5RCxPQUFPLEVBQ0wsZ0JBQWdCLEVBQ2hCLHlCQUF5QixHQUMxQixNQUFNLDZCQUE2QixDQUFDO0FBSXJDLE9BQU8sRUFFTCxnQkFBZ0IsRUFDaEIsU0FBUyxHQUNWLE1BQU0sdUJBQXVCLENBQUM7QUFpQy9CLElBQUssc0JBSUo7QUFKRCxXQUFLLHNCQUFzQjtJQUN6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
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BEACON_CHAIN_DEPOSIT_ADDRESS = exports.WETH9 = exports.constructSameAddressMap = exports.MULTICALL2_ADDRESS = exports.V3_MIGRATOR_ADDRESS = exports.NONFUNGIBLE_POSITION_MANAGER_ADDRESS = exports.TICK_LENS_ADDRESS = exports.ARB_GASINFO_ADDRESS = exports.OVM_GASPRICE_ADDRESS = exports.SWAP_ROUTER_02_ADDRESSES = exports.UNISWAP_MULTICALL_ADDRESSES = exports.MIXED_ROUTE_QUOTER_V1_ADDRESSES = exports.QUOTER_V2_ADDRESSES = exports.V3_CORE_FACTORY_ADDRESSES = exports.BNB_V3_MIGRATOR_ADDRESS = exports.BNB_SWAP_ROUTER_02_ADDRESS = exports.BNB_NONFUNGIBLE_POSITION_MANAGER_ADDRESS = exports.BNB_TICK_LENS_ADDRESS = void 0;
const sdk_core_1 = require("@uniswap/sdk-core");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const chains_1 = require("./chains");
exports.BNB_TICK_LENS_ADDRESS = sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BNB].tickLensAddress;
exports.BNB_NONFUNGIBLE_POSITION_MANAGER_ADDRESS = sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BNB].nonfungiblePositionManagerAddress;
exports.BNB_SWAP_ROUTER_02_ADDRESS = sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BNB].swapRouter02Address;
exports.BNB_V3_MIGRATOR_ADDRESS = sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BNB].v3MigratorAddress;
exports.V3_CORE_FACTORY_ADDRESSES = Object.assign(Object.assign({}, constructSameAddressMap(v3_sdk_1.FACTORY_ADDRESS)), { [sdk_core_1.ChainId.CELO]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.CELO].v3CoreFactoryAddress, [sdk_core_1.ChainId.CELO_ALFAJORES]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.CELO_ALFAJORES].v3CoreFactoryAddress, [sdk_core_1.ChainId.OPTIMISM_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.OPTIMISM_GOERLI].v3CoreFactoryAddress, [sdk_core_1.ChainId.SEPOLIA]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.SEPOLIA].v3CoreFactoryAddress, [sdk_core_1.ChainId.ARBITRUM_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.ARBITRUM_GOERLI].v3CoreFactoryAddress, [sdk_core_1.ChainId.BNB]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BNB].v3CoreFactoryAddress, [sdk_core_1.ChainId.AVALANCHE]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.AVALANCHE].v3CoreFactoryAddress, [sdk_core_1.ChainId.BASE_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BASE_GOERLI].v3CoreFactoryAddress, [sdk_core_1.ChainId.BASE]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BASE].v3CoreFactoryAddress });
exports.QUOTER_V2_ADDRESSES = Object.assign(Object.assign({}, constructSameAddressMap('0x61fFE014bA17989E743c5F6cB21bF9697530B21e')), { [sdk_core_1.ChainId.CELO]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.CELO].quoterAddress, [sdk_core_1.ChainId.CELO_ALFAJORES]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.CELO_ALFAJORES].quoterAddress, [sdk_core_1.ChainId.OPTIMISM_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.OPTIMISM_GOERLI].quoterAddress, [sdk_core_1.ChainId.SEPOLIA]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.SEPOLIA].quoterAddress, [sdk_core_1.ChainId.ARBITRUM_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.ARBITRUM_GOERLI].quoterAddress, [sdk_core_1.ChainId.BNB]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BNB].quoterAddress, [sdk_core_1.ChainId.AVALANCHE]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.AVALANCHE].quoterAddress, [sdk_core_1.ChainId.BASE_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BASE_GOERLI].quoterAddress, [sdk_core_1.ChainId.BASE]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BASE].quoterAddress });
exports.MIXED_ROUTE_QUOTER_V1_ADDRESSES = {
    [sdk_core_1.ChainId.MAINNET]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.MAINNET].v1MixedRouteQuoterAddress,
    [sdk_core_1.ChainId.GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.GOERLI].v1MixedRouteQuoterAddress,
};
exports.UNISWAP_MULTICALL_ADDRESSES = Object.assign(Object.assign({}, constructSameAddressMap('0x1F98415757620B543A52E61c46B32eB19261F984')), { [sdk_core_1.ChainId.CELO]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.CELO].multicallAddress, [sdk_core_1.ChainId.CELO_ALFAJORES]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.CELO_ALFAJORES].multicallAddress, [sdk_core_1.ChainId.OPTIMISM_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.OPTIMISM_GOERLI].multicallAddress, [sdk_core_1.ChainId.SEPOLIA]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.SEPOLIA].multicallAddress, [sdk_core_1.ChainId.ARBITRUM_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.ARBITRUM_GOERLI].multicallAddress, [sdk_core_1.ChainId.BNB]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BNB].multicallAddress, [sdk_core_1.ChainId.AVALANCHE]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.AVALANCHE].multicallAddress, [sdk_core_1.ChainId.BASE_GOERLI]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BASE_GOERLI].multicallAddress, [sdk_core_1.ChainId.BASE]: sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BASE].multicallAddress });
const SWAP_ROUTER_02_ADDRESSES = (chainId) => {
    if (chainId == sdk_core_1.ChainId.BNB) {
        return exports.BNB_SWAP_ROUTER_02_ADDRESS;
    }
    else if (chainId == sdk_core_1.ChainId.BASE) {
        return sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.BASE].swapRouter02Address;
    }
    return '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
};
exports.SWAP_ROUTER_02_ADDRESSES = SWAP_ROUTER_02_ADDRESSES;
exports.OVM_GASPRICE_ADDRESS = '0x420000000000000000000000000000000000000F';
exports.ARB_GASINFO_ADDRESS = '0x000000000000000000000000000000000000006C';
exports.TICK_LENS_ADDRESS = sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.ARBITRUM_ONE].tickLensAddress;
exports.NONFUNGIBLE_POSITION_MANAGER_ADDRESS = sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.MAINNET].nonfungiblePositionManagerAddress;
exports.V3_MIGRATOR_ADDRESS = sdk_core_1.CHAIN_TO_ADDRESSES_MAP[sdk_core_1.ChainId.MAINNET].v3MigratorAddress;
exports.MULTICALL2_ADDRESS = '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696';
function constructSameAddressMap(address, additionalNetworks = []) {
    return chains_1.NETWORKS_WITH_SAME_UNISWAP_ADDRESSES.concat(additionalNetworks).reduce((memo, chainId) => {
        memo[chainId] = address;
        return memo;
    }, {});
}
exports.constructSameAddressMap = constructSameAddressMap;
exports.WETH9 = {
    [sdk_core_1.ChainId.MAINNET]: new sdk_core_1.Token(sdk_core_1.ChainId.MAINNET, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.GOERLI]: new sdk_core_1.Token(sdk_core_1.ChainId.GOERLI, '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.SEPOLIA]: new sdk_core_1.Token(sdk_core_1.ChainId.SEPOLIA, '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.OPTIMISM]: new sdk_core_1.Token(sdk_core_1.ChainId.OPTIMISM, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.OPTIMISM_GOERLI]: new sdk_core_1.Token(sdk_core_1.ChainId.OPTIMISM_GOERLI, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.ARBITRUM_ONE]: new sdk_core_1.Token(sdk_core_1.ChainId.ARBITRUM_ONE, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.ARBITRUM_GOERLI]: new sdk_core_1.Token(sdk_core_1.ChainId.ARBITRUM_GOERLI, '0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.BASE_GOERLI]: new sdk_core_1.Token(sdk_core_1.ChainId.BASE_GOERLI, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.BASE]: new sdk_core_1.Token(sdk_core_1.ChainId.BASE, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    [sdk_core_1.ChainId.OPTIMISM_SEPOLIA]: new sdk_core_1.Token(sdk_core_1.ChainId.OPTIMISM_SEPOLIA, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
};
exports.BEACON_CHAIN_DEPOSIT_ADDRESS = '0x00000000219ab540356cBB839Cbe05303d7705Fa';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkcmVzc2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3V0aWwvYWRkcmVzc2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGdEQUEyRTtBQUMzRSw0Q0FBa0Q7QUFFbEQscUNBQWdFO0FBRW5ELFFBQUEscUJBQXFCLEdBQ2hDLGlDQUFzQixDQUFDLGtCQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsZUFBZSxDQUFDO0FBQ3pDLFFBQUEsd0NBQXdDLEdBQ25ELGlDQUFzQixDQUFDLGtCQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsaUNBQWlDLENBQUM7QUFDM0QsUUFBQSwwQkFBMEIsR0FDckMsaUNBQXNCLENBQUMsa0JBQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxtQkFBb0IsQ0FBQztBQUM5QyxRQUFBLHVCQUF1QixHQUNsQyxpQ0FBc0IsQ0FBQyxrQkFBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLGlCQUFpQixDQUFDO0FBRTNDLFFBQUEseUJBQXlCLG1DQUNqQyx1QkFBdUIsQ0FBQyx3QkFBZSxDQUFDLEtBQzNDLENBQUMsa0JBQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxpQ0FBc0IsQ0FBQyxrQkFBTyxDQUFDLElBQUksQ0FBQyxDQUFDLG9CQUFvQixFQUN6RSxDQUFDLGtCQUFPLENBQUMsY0FBYyxDQUFDLEVBQ3RCLGlDQUFzQixDQUFDLGtCQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsb0JBQW9CLEVBQ3JFLENBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUMsRUFDdkIsaUNBQXNCLENBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxvQkFBb0IsRUFDdEUsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQyxFQUNmLGlDQUFzQixDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsb0JBQW9CLEVBQzlELENBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUMsRUFDdkIsaUNBQXNCLENBQUMsa0JBQU8sQ0FBQyxlQUFl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
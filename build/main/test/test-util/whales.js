"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WHALES = void 0;
const sdk_core_1 = require("@uniswap/sdk-core");
const src_1 = require("../../src");
const mock_data_1 = require("./mock-data");
const WHALES = (token) => {
    switch (token) {
        case sdk_core_1.Ether.onChain(sdk_core_1.ChainId.MAINNET):
            return '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
        case src_1.ExtendedEther.onChain(sdk_core_1.ChainId.MAINNET):
            return '0x0716a17FBAeE714f1E6aB0f9d59edbC5f09815C0';
        case src_1.ExtendedEther.onChain(sdk_core_1.ChainId.ARBITRUM_ONE):
            return '0xf977814e90da44bfa03b6295a0616a897441acec';
        case (0, src_1.nativeOnChain)(sdk_core_1.ChainId.POLYGON):
            return '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245';
        case (0, src_1.nativeOnChain)(sdk_core_1.ChainId.GOERLI):
            return '0x08505F42D5666225d5d73B842dAdB87CCA44d1AE';
        case (0, src_1.nativeOnChain)(sdk_core_1.ChainId.BASE):
            return '0x428ab2ba90eba0a4be7af34c9ac451ab061ac010';
        case (0, src_1.nativeOnChain)(sdk_core_1.ChainId.AVALANCHE):
            return '0x4aeFa39caEAdD662aE31ab0CE7c8C2c9c0a013E8';
        case (0, src_1.nativeOnChain)(sdk_core_1.ChainId.BNB):
            return '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3';
        case (0, src_1.nativeOnChain)(sdk_core_1.ChainId.OPTIMISM):
            return '0x12478d1a60a910C9CbFFb90648766a2bDD5918f5';
        case src_1.WETH9[1]:
            return '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.MAINNET):
            return '0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.ARBITRUM_ONE):
            return '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.GOERLI):
            return '0x2372031bb0fc735722aa4009aebf66e8beaf4ba1';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.POLYGON):
            return '0x369582d2010b6ed950b571f4101e3bb9b554876f';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.BASE):
            return '0x4bb6b2efe7036020ba6f02a05602546c9f25bf28';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.OPTIMISM):
            return '0x12478d1a60a910C9CbFFb90648766a2bDD5918f5';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.BNB):
            return '0x59d779BED4dB1E734D3fDa3172d45bc3063eCD69';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.AVALANCHE):
            return '0xba12222222228d8ba445958a75a0704d566bf2c8';
        case src_1.USDC_MAINNET:
            return '0x8eb8a3b98659cce290402893d0123abb75e3ab28';
        case src_1.UNI_MAINNET:
        case src_1.DAI_MAINNET:
        case src_1.USDT_MAINNET:
            return '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503';
        case src_1.UNI_GOERLI:
            return '0x41653c7d61609d856f29355e404f310ec4142cfb';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.OPTIMISM):
            return '0xad7b4c162707e0b2b5f6fddbd3f8538a5fba0d60';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.OPTIMISM_GOERLI):
            return '0x4cb0645e92a3b5872ae54e5704e03c09ca0ea220';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.ARBITRUM_ONE):
            return '0xf89d7b9c864f589bbf53a82105107622b35eaa40';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.ARBITRUM_GOERLI):
            return '0x7e3114fcbc1d529fd96de61d65d4a03071609c56';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.SEPOLIA):
            return '0xe2a3422f3168149AD2d11b4dE2B97b05f1ebF76e';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.POLYGON):
            return '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.POLYGON_MUMBAI):
            return '0x48520ff9b32d8b5bf87abf789ea7b3c394c95ebe';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.AVALANCHE):
            return '0x9f8c163cBA728e99993ABe7495F06c0A3c8Ac8b9';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.BNB):
            return '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3';
        case (0, src_1.USDC_ON)(sdk_core_1.ChainId.BASE):
            return '0x4a3636608d7bc5776cb19eb72caa36ebb9ea683b';
        case (0, src_1.DAI_ON)(sdk_core_1.ChainId.GOERLI):
            return '0x20918f71e99c09ae2ac3e33dbde33457d3be01f4';
        case (0, src_1.DAI_ON)(sdk_core_1.ChainId.SEPOLIA):
            return '0x67550Df3290415611F6C140c81Cd770Ff1742cb9';
        case (0, src_1.DAI_ON)(sdk_core_1.ChainId.OPTIMISM):
            return '0x100bdc1431a9b09c61c0efc5776814285f8fb248';
        case (0, src_1.DAI_ON)(sdk_core_1.ChainId.ARBITRUM_ONE):
            return '0x07b23ec6aedf011114d3ab6027d69b561a2f635e';
        case (0, src_1.DAI_ON)(sdk_core_1.ChainId.POLYGON):
            return '0xf04adbf75cdfc5ed26eea4bbbb991db002036bdd';
        case (0, src_1.DAI_ON)(sdk_core_1.ChainId.POLYGON_MUMBAI):
            return '0xda8ab4137fe28f969b27c780d313d1bb62c8341e';
        case (0, src_1.DAI_ON)(sdk_core_1.ChainId.AVALANCHE):
            return '0x835866d37AFB8CB8F8334dCCdaf66cf01832Ff5D';
        case src_1.CEUR_CELO:
            return '0x612A7c4E40EAcb63dADaD4939dFedb9d3397E6fd';
        case src_1.CEUR_CELO_ALFAJORES:
            return '0x489324b266DFb125CC791B91Bc68F307cE3f6691';
        case (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.CELO):
            return '0x6cC083Aed9e3ebe302A6336dBC7c921C9f03349E';
        case src_1.CUSD_CELO:
            return '0xC32cBaf3D44dA6fbC761289b871af1A30cc7f993';
        case mock_data_1.BULLET_WITHOUT_TAX || mock_data_1.BULLET:
            return '0x171d311eAcd2206d21Cb462d661C33F0eddadC03';
        default:
            return '0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e';
    }
};
exports.WHALES = WHALES;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2hhbGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vdGVzdC90ZXN0LXV0aWwvd2hhbGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGdEQUE2RDtBQUM3RCxtQ0FlbUI7QUFDbkIsMkNBQXlEO0FBRWxELE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBZSxFQUFVLEVBQUU7SUFDaEQsUUFBUSxLQUFLLEVBQUU7UUFDYixLQUFLLGdCQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFhO1lBQzdDLE9BQU8sNENBQTRDLENBQUM7UUFDdEQsS0FBSyxtQkFBYSxDQUFDLE9BQU8sQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQztZQUN6QyxPQUFPLDRDQUE0QyxDQUFDO1FBQ3RELEtBQUssbUJBQWEsQ0FBQyxPQUFPLENBQUMsa0JBQU8sQ0FBQyxZQUFZLENBQUM7WUFDOUMsT0FBTyw0Q0FBNEMsQ0FBQztRQUN0RCxLQUFLLElBQUEsbUJBQWEsRUFBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQztZQUNqQyxPQUFPLDRDQUE0QyxDQUFDO1FBQ3RELEtBQUssSUFBQSxtQkFBYSxFQUFDLGtCQUFPLENBQUMsTUFBTSxDQUFDO1lBQ2hDLE9BQU8sNENBQTRDLENBQUM7UUFDdEQsS0FBSyxJQUFBLG1CQUFhLEVBQUMsa0JBQU8sQ0FBQyxJQUFJLENBQUM7WUFDOUIsT0FBTyw0Q0FBNEMsQ0FBQztRQUN0RCxLQUFLLElBQUEsbUJBQWEsRUFBQyxrQkFBTyxDQUFDLFNBQVMsQ0FBQztZQUNuQyxPQUFPLDRDQUE0QyxDQUFDO1FBQ3RELEtBQUssSUFBQSxtQkFBYSxFQUFDLGtCQUFPLENBQUMsR0FBRyxDQUFDO1lBQzdCLE9BQU8sNENBQTRDLENBQUM7UUFDdEQsS0FBSyxJQUFBLG1CQUFhLEVBQUMsa0JBQU8sQ0FBQyxRQUFRLENBQUM7WUFDbEMsT0FBTyw0Q0FBNEMsQ0FBQztRQUN0RCxLQUFLLFdBQUssQ0FBQyxD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
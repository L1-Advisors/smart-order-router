import { ChainId, Ether } from '@uniswap/sdk-core';
import { CEUR_CELO, CEUR_CELO_ALFAJORES, CUSD_CELO, DAI_MAINNET, DAI_ON, ExtendedEther, nativeOnChain, UNI_GOERLI, UNI_MAINNET, USDC_MAINNET, USDC_ON, USDT_MAINNET, WETH9, WNATIVE_ON, } from '../../src';
import { BULLET, BULLET_WITHOUT_TAX } from './mock-data';
export const WHALES = (token) => {
    switch (token) {
        case Ether.onChain(ChainId.MAINNET):
            return '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
        case ExtendedEther.onChain(ChainId.MAINNET):
            return '0x0716a17FBAeE714f1E6aB0f9d59edbC5f09815C0';
        case ExtendedEther.onChain(ChainId.ARBITRUM_ONE):
            return '0xf977814e90da44bfa03b6295a0616a897441acec';
        case nativeOnChain(ChainId.POLYGON):
            return '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245';
        case nativeOnChain(ChainId.GOERLI):
            return '0x08505F42D5666225d5d73B842dAdB87CCA44d1AE';
        case nativeOnChain(ChainId.BASE):
            return '0x428ab2ba90eba0a4be7af34c9ac451ab061ac010';
        case nativeOnChain(ChainId.AVALANCHE):
            return '0x4aeFa39caEAdD662aE31ab0CE7c8C2c9c0a013E8';
        case nativeOnChain(ChainId.BNB):
            return '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3';
        case nativeOnChain(ChainId.OPTIMISM):
            return '0x12478d1a60a910C9CbFFb90648766a2bDD5918f5';
        case WETH9[1]:
            return '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3';
        case WNATIVE_ON(ChainId.MAINNET):
            return '0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e';
        case WNATIVE_ON(ChainId.ARBITRUM_ONE):
            return '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e';
        case WNATIVE_ON(ChainId.GOERLI):
            return '0x2372031bb0fc735722aa4009aebf66e8beaf4ba1';
        case WNATIVE_ON(ChainId.POLYGON):
            return '0x369582d2010b6ed950b571f4101e3bb9b554876f';
        case WNATIVE_ON(ChainId.BASE):
            return '0x4bb6b2efe7036020ba6f02a05602546c9f25bf28';
        case WNATIVE_ON(ChainId.OPTIMISM):
            return '0x12478d1a60a910C9CbFFb90648766a2bDD5918f5';
        case WNATIVE_ON(ChainId.BNB):
            return '0x59d779BED4dB1E734D3fDa3172d45bc3063eCD69';
        case WNATIVE_ON(ChainId.AVALANCHE):
            return '0xba12222222228d8ba445958a75a0704d566bf2c8';
        case USDC_MAINNET:
            return '0x8eb8a3b98659cce290402893d0123abb75e3ab28';
        case UNI_MAINNET:
        case DAI_MAINNET:
        case USDT_MAINNET:
            return '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503';
        case UNI_GOERLI:
            return '0x41653c7d61609d856f29355e404f310ec4142cfb';
        case USDC_ON(ChainId.OPTIMISM):
            return '0xad7b4c162707e0b2b5f6fddbd3f8538a5fba0d60';
        case USDC_ON(ChainId.OPTIMISM_GOERLI):
            return '0x4cb0645e92a3b5872ae54e5704e03c09ca0ea220';
        case USDC_ON(ChainId.ARBITRUM_ONE):
            return '0xf89d7b9c864f589bbf53a82105107622b35eaa40';
        case USDC_ON(ChainId.ARBITRUM_GOERLI):
            return '0x7e3114fcbc1d529fd96de61d65d4a03071609c56';
        case USDC_ON(ChainId.SEPOLIA):
            return '0xe2a3422f3168149AD2d11b4dE2B97b05f1ebF76e';
        case USDC_ON(ChainId.POLYGON):
            return '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245';
        case USDC_ON(ChainId.POLYGON_MUMBAI):
            return '0x48520ff9b32d8b5bf87abf789ea7b3c394c95ebe';
        case USDC_ON(ChainId.AVALANCHE):
            return '0x9f8c163cBA728e99993ABe7495F06c0A3c8Ac8b9';
        case USDC_ON(ChainId.BNB):
            return '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3';
        case USDC_ON(ChainId.BASE):
            return '0x4a3636608d7bc5776cb19eb72caa36ebb9ea683b';
        case DAI_ON(ChainId.GOERLI):
            return '0x20918f71e99c09ae2ac3e33dbde33457d3be01f4';
        case DAI_ON(ChainId.SEPOLIA):
            return '0x67550Df3290415611F6C140c81Cd770Ff1742cb9';
        case DAI_ON(ChainId.OPTIMISM):
            return '0x100bdc1431a9b09c61c0efc5776814285f8fb248';
        case DAI_ON(ChainId.ARBITRUM_ONE):
            return '0x07b23ec6aedf011114d3ab6027d69b561a2f635e';
        case DAI_ON(ChainId.POLYGON):
            return '0xf04adbf75cdfc5ed26eea4bbbb991db002036bdd';
        case DAI_ON(ChainId.POLYGON_MUMBAI):
            return '0xda8ab4137fe28f969b27c780d313d1bb62c8341e';
        case DAI_ON(ChainId.AVALANCHE):
            return '0x835866d37AFB8CB8F8334dCCdaf66cf01832Ff5D';
        case CEUR_CELO:
            return '0x612A7c4E40EAcb63dADaD4939dFedb9d3397E6fd';
        case CEUR_CELO_ALFAJORES:
            return '0x489324b266DFb125CC791B91Bc68F307cE3f6691';
        case WNATIVE_ON(ChainId.CELO):
            return '0x6cC083Aed9e3ebe302A6336dBC7c921C9f03349E';
        case CUSD_CELO:
            return '0xC32cBaf3D44dA6fbC761289b871af1A30cc7f993';
        case BULLET_WITHOUT_TAX || BULLET:
            return '0x171d311eAcd2206d21Cb462d661C33F0eddadC03';
        default:
            return '0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e';
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2hhbGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vdGVzdC90ZXN0LXV0aWwvd2hhbGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQVksS0FBSyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDN0QsT0FBTyxFQUNMLFNBQVMsRUFDVCxtQkFBbUIsRUFDbkIsU0FBUyxFQUNULFdBQVcsRUFDWCxNQUFNLEVBQ04sYUFBYSxFQUNiLGFBQWEsRUFDYixVQUFVLEVBQ1YsV0FBVyxFQUNYLFlBQVksRUFDWixPQUFPLEVBQ1AsWUFBWSxFQUNaLEtBQUssRUFDTCxVQUFVLEdBQ1gsTUFBTSxXQUFXLENBQUM7QUFDbkIsT0FBTyxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUV6RCxNQUFNLENBQUMsTUFBTSxNQUFNLEdBQUcsQ0FBQyxLQUFlLEVBQVUsRUFBRTtJQUNoRCxRQUFRLEtBQUssRUFBRTtRQUNiLEtBQUssS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFhO1lBQzdDLE9BQU8sNENBQTRDLENBQUM7UUFDdEQsS0FBSyxhQUFhLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDekMsT0FBTyw0Q0FBNEMsQ0FBQztRQUN0RCxLQUFLLGFBQWEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztZQUM5QyxPQUFPLDRDQUE0QyxDQUFDO1FBQ3RELEtBQUssYUFBYSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDakMsT0FBTyw0Q0FBNEMsQ0FBQztRQUN0RCxLQUFLLGFBQWEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO1lBQ2hDLE9BQU8sNENBQTRDLENBQUM7UUFDdEQsS0FBSyxhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztZQUM5QixPQUFPLDRDQUE0QyxDQUFDO1FBQ3RELEtBQUssYUFB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
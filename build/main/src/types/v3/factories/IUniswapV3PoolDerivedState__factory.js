"use strict";
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IUniswapV3PoolDerivedState__factory = void 0;
const ethers_1 = require("ethers");
const _abi = [
    {
        inputs: [
            {
                internalType: "uint32[]",
                name: "secondsAgos",
                type: "uint32[]",
            },
        ],
        name: "observe",
        outputs: [
            {
                internalType: "int56[]",
                name: "tickCumulatives",
                type: "int56[]",
            },
            {
                internalType: "uint160[]",
                name: "secondsPerLiquidityCumulativeX128s",
                type: "uint160[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "int24",
                name: "tickLower",
                type: "int24",
            },
            {
                internalType: "int24",
                name: "tickUpper",
                type: "int24",
            },
        ],
        name: "snapshotCumulativesInside",
        outputs: [
            {
                internalType: "int56",
                name: "tickCumulativeInside",
                type: "int56",
            },
            {
                internalType: "uint160",
                name: "secondsPerLiquidityInsideX128",
                type: "uint160",
            },
            {
                internalType: "uint32",
                name: "secondsInside",
                type: "uint32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];
class IUniswapV3PoolDerivedState__factory {
    static createInterface() {
        return new ethers_1.utils.Interface(_abi);
    }
    static connect(address, signerOrProvider) {
        return new ethers_1.Contract(address, _abi, signerOrProvider);
    }
}
exports.IUniswapV3PoolDerivedState__factory = IUniswapV3PoolDerivedState__factory;
IUniswapV3PoolDerivedState__factory.abi = _abi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSVVuaXN3YXBWM1Bvb2xEZXJpdmVkU3RhdGVfX2ZhY3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvdHlwZXMvdjMvZmFjdG9yaWVzL0lVbmlzd2FwVjNQb29sRGVyaXZlZFN0YXRlX19mYWN0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSwrQ0FBK0M7QUFDL0Msb0JBQW9CO0FBQ3BCLG9CQUFvQjs7O0FBR3BCLG1DQUFpRDtBQU1qRCxNQUFNLElBQUksR0FBRztJQUNYO1FBQ0UsTUFBTSxFQUFFO1lBQ047Z0JBQ0UsWUFBWSxFQUFFLFVBQVU7Z0JBQ3hCLElBQUksRUFBRSxhQUFhO2dCQUNuQixJQUFJLEVBQUUsVUFBVTthQUNqQjtTQUNGO1FBQ0QsSUFBSSxFQUFFLFNBQVM7UUFDZixPQUFPLEVBQUU7WUFDUDtnQkFDRSxZQUFZLEVBQUUsU0FBUztnQkFDdkIsSUFBSSxFQUFFLGlCQUFpQjtnQkFDdkIsSUFBSSxFQUFFLFNBQVM7YUFDaEI7WUFDRDtnQkFDRSxZQUFZLEVBQUUsV0FBVztnQkFDekIsSUFBSSxFQUFFLG9DQUFvQztnQkFDMUMsSUFBSSxFQUFFLFdBQVc7YUFDbEI7U0FDRjtRQUNELGVBQWUsRUFBRSxNQUFNO1FBQ3ZCLElBQUksRUFBRSxVQUFVO0tBQ2pCO0lBQ0Q7UUFDRSxNQUFNLEVBQUU7WUFDTjtnQkFDRSxZQUFZLEVBQUUsT0FBTztnQkFDckIsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSxPQUFPO2FBQ2Q7WUFDRDtnQkFDRSxZQUFZLEVBQUUsT0FBTztnQkFDckIsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSxPQUFPO2FBQ2Q7U0FDRjtRQUNELElBQUksRUFBRSwyQkFBMkI7UUFDakMsT0FBTyxFQUFFO1lBQ1A7Z0JBQ0UsWUFBWSxFQUFFLE9BQU87Z0JBQ3JCLElBQUksRUFBRSxzQkFBc0I7Z0JBQzVCLElBQUksRUFBRSxPQUFPO2FBQ2Q7WUFDRDtnQkFDRSxZQUFZLEVBQUUsU0FBUztnQkFDdkIsSUFBSSxFQUFFLCtCQUErQjtnQkFDckMsSUFBSSxFQUFFLFNBQVM7YUFDaEI7WUFDRDtnQkFDRSxZQUFZLEVBQUUsUUFBUTtnQkFDdEIsSUFBSSxFQUFFLGVBQWU7Z0JBQ3JCLElBQUksRUFBRSxRQUFRO2FBQ2Y7U0FDRjtRQUNELGVBQWUsRUFBRSxNQUFNO1FBQ3ZCLElBQUksRUFBRSxVQUFVO0tBQ2pCO0NBQ0YsQ0FBQztBQUVGLE1BQWEsbUNBQW1DO0lBRTlDLE1BQU0sQ0FBQyxlQUFlO1FBQ3BCLE9BQU8sSUFBSSxjQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBd0MsQ0FBQztJQUMxRSxDQUFDO0lBQ0QsTUFBTSxDQUFDLE9BQU8sQ0FDWixPQUFlLEVBQ2YsZ0JBQW1DO1FBRW5DLE9BQU8sSUFBSSxpQkFBUSxDQUNqQixPQUFPLEVBQ1AsSUFBSSxFQUNKLGdCQUFnQixDQUNhLENBQUM7SUFDbEMsQ0FBQzs7QUFkSCxrRkFlQztBQWRpQix1Q0FBRyxHQUFHLElBQUksQ0FBQyJ9
"use strict";
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenFeeDetector__factory = void 0;
const ethers_1 = require("ethers");
const _abi = [
    {
        inputs: [
            {
                internalType: "address",
                name: "_factoryV2",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [],
        name: "PairLookupFailed",
        type: "error",
    },
    {
        inputs: [],
        name: "SameToken",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "address[]",
                name: "tokens",
                type: "address[]",
            },
            {
                internalType: "address",
                name: "baseToken",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amountToBorrow",
                type: "uint256",
            },
        ],
        name: "batchValidate",
        outputs: [
            {
                components: [
                    {
                        internalType: "uint256",
                        name: "buyFeeBps",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "sellFeeBps",
                        type: "uint256",
                    },
                ],
                internalType: "struct TokenFees[]",
                name: "fotResults",
                type: "tuple[]",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount0",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "uniswapV2Call",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "token",
                type: "address",
            },
            {
                internalType: "address",
                name: "baseToken",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amountToBorrow",
                type: "uint256",
            },
        ],
        name: "validate",
        outputs: [
            {
                components: [
                    {
                        internalType: "uint256",
                        name: "buyFeeBps",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "sellFeeBps",
                        type: "uint256",
                    },
                ],
                internalType: "struct TokenFees",
                name: "fotResult",
                type: "tuple",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
];
class TokenFeeDetector__factory {
    static createInterface() {
        return new ethers_1.utils.Interface(_abi);
    }
    static connect(address, signerOrProvider) {
        return new ethers_1.Contract(address, _abi, signerOrProvider);
    }
}
exports.TokenFeeDetector__factory = TokenFeeDetector__factory;
TokenFeeDetector__factory.abi = _abi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVG9rZW5GZWVEZXRlY3Rvcl9fZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy90eXBlcy9vdGhlci9mYWN0b3JpZXMvVG9rZW5GZWVEZXRlY3Rvcl9fZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsK0NBQStDO0FBQy9DLG9CQUFvQjtBQUNwQixvQkFBb0I7OztBQUdwQixtQ0FBaUQ7QUFNakQsTUFBTSxJQUFJLEdBQUc7SUFDWDtRQUNFLE1BQU0sRUFBRTtZQUNOO2dCQUNFLFlBQVksRUFBRSxTQUFTO2dCQUN2QixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsSUFBSSxFQUFFLFNBQVM7YUFDaEI7U0FDRjtRQUNELGVBQWUsRUFBRSxZQUFZO1FBQzdCLElBQUksRUFBRSxhQUFhO0tBQ3BCO0lBQ0Q7UUFDRSxNQUFNLEVBQUUsRUFBRTtRQUNWLElBQUksRUFBRSxrQkFBa0I7UUFDeEIsSUFBSSxFQUFFLE9BQU87S0FDZDtJQUNEO1FBQ0UsTUFBTSxFQUFFLEVBQUU7UUFDVixJQUFJLEVBQUUsV0FBVztRQUNqQixJQUFJLEVBQUUsT0FBTztLQUNkO0lBQ0Q7UUFDRSxNQUFNLEVBQUU7WUFDTjtnQkFDRSxZQUFZLEVBQUUsV0FBVztnQkFDekIsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFdBQVc7YUFDbEI7WUFDRDtnQkFDRSxZQUFZLEVBQUUsU0FBUztnQkFDdkIsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSxTQUFTO2FBQ2hCO1lBQ0Q7Z0JBQ0UsWUFBWSxFQUFFLFNBQVM7Z0JBQ3ZCLElBQUksRUFBRSxnQkFBZ0I7Z0JBQ3RCLElBQUksRUFBRSxTQUFTO2FBQ2hCO1NBQ0Y7UUFDRCxJQUFJLEVBQUUsZUFBZTtRQUNyQixPQUFPLEVBQUU7WUFDUDtnQkFDRSxVQUFVLEVBQUU7b0JBQ1Y7d0JBQ0UsWUFBWSxFQUFFLFNBQVM7d0JBQ3ZCLElBQUksRUFBRSxX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
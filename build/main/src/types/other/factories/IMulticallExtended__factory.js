"use strict";
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMulticallExtended__factory = void 0;
const ethers_1 = require("ethers");
const _abi = [
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "previousBlockhash",
                type: "bytes32",
            },
            {
                internalType: "bytes[]",
                name: "data",
                type: "bytes[]",
            },
        ],
        name: "multicall",
        outputs: [
            {
                internalType: "bytes[]",
                name: "results",
                type: "bytes[]",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
            {
                internalType: "bytes[]",
                name: "data",
                type: "bytes[]",
            },
        ],
        name: "multicall",
        outputs: [
            {
                internalType: "bytes[]",
                name: "results",
                type: "bytes[]",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes[]",
                name: "data",
                type: "bytes[]",
            },
        ],
        name: "multicall",
        outputs: [
            {
                internalType: "bytes[]",
                name: "results",
                type: "bytes[]",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
];
class IMulticallExtended__factory {
    static createInterface() {
        return new ethers_1.utils.Interface(_abi);
    }
    static connect(address, signerOrProvider) {
        return new ethers_1.Contract(address, _abi, signerOrProvider);
    }
}
exports.IMulticallExtended__factory = IMulticallExtended__factory;
IMulticallExtended__factory.abi = _abi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSU11bHRpY2FsbEV4dGVuZGVkX19mYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3R5cGVzL290aGVyL2ZhY3Rvcmllcy9JTXVsdGljYWxsRXh0ZW5kZWRfX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLCtDQUErQztBQUMvQyxvQkFBb0I7QUFDcEIsb0JBQW9COzs7QUFHcEIsbUNBQWlEO0FBTWpELE1BQU0sSUFBSSxHQUFHO0lBQ1g7UUFDRSxNQUFNLEVBQUU7WUFDTjtnQkFDRSxZQUFZLEVBQUUsU0FBUztnQkFDdkIsSUFBSSxFQUFFLG1CQUFtQjtnQkFDekIsSUFBSSxFQUFFLFNBQVM7YUFDaEI7WUFDRDtnQkFDRSxZQUFZLEVBQUUsU0FBUztnQkFDdkIsSUFBSSxFQUFFLE1BQU07Z0JBQ1osSUFBSSxFQUFFLFNBQVM7YUFDaEI7U0FDRjtRQUNELElBQUksRUFBRSxXQUFXO1FBQ2pCLE9BQU8sRUFBRTtZQUNQO2dCQUNFLFlBQVksRUFBRSxTQUFTO2dCQUN2QixJQUFJLEVBQUUsU0FBUztnQkFDZixJQUFJLEVBQUUsU0FBUzthQUNoQjtTQUNGO1FBQ0QsZUFBZSxFQUFFLFNBQVM7UUFDMUIsSUFBSSxFQUFFLFVBQVU7S0FDakI7SUFDRDtRQUNFLE1BQU0sRUFBRTtZQUNOO2dCQUNFLFlBQVksRUFBRSxTQUFTO2dCQUN2QixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLFNBQVM7YUFDaEI7WUFDRDtnQkFDRSxZQUFZLEVBQUUsU0FBUztnQkFDdkIsSUFBSSxFQUFFLE1BQU07Z0JBQ1osSUFBSSxFQUFFLFNBQVM7YUFDaEI7U0FDRjtRQUNELElBQUksRUFBRSxXQUFXO1FBQ2pCLE9BQU8sRUFBRTtZQUNQO2dCQUNFLFlBQVksRUFBRSxTQUFTO2dCQUN2QixJQUFJLEVBQUUsU0FBUztnQkFDZixJQUFJLEVBQUUsU0FBUzthQUNoQjtTQUNGO1FBQ0QsZUFBZSxFQUFFLFNBQVM7UUFDMUIsSUFBSSxFQUFFLFVBQVU7S0FDakI7SUFDRDtRQUNFLE1BQU0sRUFBRTtZQUNOO2dCQUNFLFlBQVksRUFBRSxTQUFTO2dCQUN2QixJQUFJLEVBQUUsTUFBTTtnQkFDWixJQUFJLEVBQUUsU0FBUzthQUNoQjtTQUNGO1FBQ0QsSUFBSSxFQUFFLFdBQVc7UUFDakIsT0FBTyxFQUFFO1lBQ1A7Z0JBQ0UsWUFBWSxFQUFFLFNBQVM7Z0JBQ3ZCLElBQUksRUFBRSxTQUFTO2dCQUNmLElBQUksRUFBRSxTQUFTO2FBQ2hCO1NBQ0Y7UUFDRCxlQUFlLEVBQUUsU0FBUztRQUMxQixJQUFJLEVBQUUsVUFBVTtLQUNqQjtDQUNGLENBQUM7QUFFRixNQUFhLDJCQUEyQjtJQUV0QyxNQUFNLENBQUMsZUFBZTtRQUNwQixPQUFPLElBQUksY0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQWdDLENBQUM7SUFDbEUsQ0FBQztJQUNELE1BQU0sQ0FBQyxPQUFPLENBQ1osT0FBZSxFQUNmLGdCQUFtQztRQUVuQyxPQUFPLElBQUksaUJBQVEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixDQUF1QixDQUFDO0lBQzdFLENBQUM7O0FBVkgsa0VBV0M7QUFWaUIsK0JBQUcsR0FBRyxJQUFJLENBQUMifQ==
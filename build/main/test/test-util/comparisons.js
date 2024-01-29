"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.poolsContain = exports.poolEquals = void 0;
const v3_sdk_1 = require("@uniswap/v3-sdk");
const lodash_1 = __importDefault(require("lodash"));
const poolEquals = (p1, p2) => v3_sdk_1.Pool.getAddress(p1.token0, p1.token1, p1.fee) ==
    v3_sdk_1.Pool.getAddress(p2.token0, p2.token1, p2.fee);
exports.poolEquals = poolEquals;
const poolsContain = (pools, pool) => {
    const addresses = lodash_1.default.map(pools, (p) => v3_sdk_1.Pool.getAddress(p.token0, p.token1, p.fee));
    return lodash_1.default.includes(addresses, v3_sdk_1.Pool.getAddress(pool.token0, pool.token1, pool.fee));
};
exports.poolsContain = poolsContain;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGFyaXNvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi90ZXN0L3Rlc3QtdXRpbC9jb21wYXJpc29ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSw0Q0FBdUM7QUFDdkMsb0RBQXVCO0FBRWhCLE1BQU0sVUFBVSxHQUFHLENBQUMsRUFBUSxFQUFFLEVBQVEsRUFBRSxFQUFFLENBQy9DLGFBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUM7SUFDN0MsYUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBRm5DLFFBQUEsVUFBVSxjQUV5QjtBQUV6QyxNQUFNLFlBQVksR0FBRyxDQUFDLEtBQWEsRUFBRSxJQUFVLEVBQUUsRUFBRTtJQUN4RCxNQUFNLFNBQVMsR0FBRyxnQkFBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUNuQyxhQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQzNDLENBQUM7SUFDRixPQUFPLGdCQUFDLENBQUMsUUFBUSxDQUNmLFNBQVMsRUFDVCxhQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQ3BELENBQUM7QUFDSixDQUFDLENBQUM7QUFSVyxRQUFBLFlBQVksZ0JBUXZCIn0=
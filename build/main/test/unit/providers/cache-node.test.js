"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cache_1 = __importDefault(require("node-cache"));
const src_1 = require("../../../src");
describe('NodeJSCache', () => {
    const underlyingCache = new node_cache_1.default();
    const cache = new src_1.NodeJSCache(underlyingCache);
    it('set keys and batchGet', async () => {
        await Promise.all([
            cache.set('key1', 'value1'),
            cache.set('key2', 'value2')
        ]);
        const batchGet = await cache.batchGet(new Set(['key1', 'key2', 'key3']));
        expect(batchGet['key1']).toEqual('value1');
        expect(batchGet['key2']).toEqual('value2');
        expect(batchGet['key3']).toBeUndefined();
    });
    it('set keys with ttl', async () => {
        var _a, _b;
        const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
        await Promise.all([
            cache.set('key1', 'value1', 600),
            cache.set('key2', 'value2', 10)
        ]);
        // rounded milliseconds to seconds, so that the flaky test failure due to millisecond difference is avoided
        expect(Math.floor(((_a = underlyingCache.getTtl('key1')) !== null && _a !== void 0 ? _a : 0) / 1000)).toEqual(currentEpochTimeInSeconds + 600);
        expect(Math.floor(((_b = underlyingCache.getTtl('key2')) !== null && _b !== void 0 ? _b : 0) / 1000)).toEqual(currentEpochTimeInSeconds + 10);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGUtbm9kZS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9jYWNoZS1ub2RlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw0REFBbUM7QUFDbkMsc0NBQTJDO0FBRTNDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO0lBQzNCLE1BQU0sZUFBZSxHQUFHLElBQUksb0JBQVMsRUFBRSxDQUFBO0lBQ3ZDLE1BQU0sS0FBSyxHQUFHLElBQUksaUJBQVcsQ0FBUyxlQUFlLENBQUMsQ0FBQTtJQUV0RCxFQUFFLENBQUMsdUJBQXVCLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDckMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2hCLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQztZQUMzQixLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUM7U0FDNUIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMzQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUMzQyxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLElBQUksRUFBRTs7UUFDakMsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUVoRSxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDaEIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQztZQUNoQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDO1NBQ2hDLENBQUMsQ0FBQztRQUVILDJHQUEyRztRQUMzRyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQUEsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsbUNBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMseUJBQXlCLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDMUcsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFBLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLG1DQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLHlCQUF5QixHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQzNHLENBQUMsQ0FBQyxDQUFBO0FBQ0osQ0FBQyxDQUFDLENBQUMifQ==
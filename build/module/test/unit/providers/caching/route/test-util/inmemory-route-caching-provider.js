import { CacheMode, IRouteCachingProvider } from '../../../../../../src';
export class InMemoryRouteCachingProvider extends IRouteCachingProvider {
    constructor() {
        super(...arguments);
        this.routesCache = new Map();
        this.blocksToLive = 1;
        this.cacheMode = CacheMode.Darkmode;
        this.forceFail = false;
        this.internalGetCacheRouteCalls = 0;
        this.internalSetCacheRouteCalls = 0;
        this.getCacheModeCalls = 0;
    }
    async _getBlocksToLive(_cachedRoutes, _amount) {
        return this.blocksToLive;
    }
    async _getCachedRoute(chainId, amount, quoteToken, tradeType, protocols) {
        this.internalGetCacheRouteCalls += 1;
        const cacheKey = `${amount.currency.wrapped.symbol}/${quoteToken.symbol}/${chainId}/${tradeType}/${protocols.sort()}`;
        return this.routesCache.get(cacheKey);
    }
    async _setCachedRoute(cachedRoutes, _amount) {
        this.internalSetCacheRouteCalls += 1;
        if (this.forceFail)
            return false;
        const cacheKey = `${cachedRoutes.tokenIn.symbol}/${cachedRoutes.tokenOut.symbol}/${cachedRoutes.chainId}/${cachedRoutes.tradeType}/${cachedRoutes.protocolsCovered.sort()}`;
        this.routesCache.set(cacheKey, cachedRoutes);
        return true;
    }
    async getCacheMode(_chainId, _amount, _quoteToken, _tradeType, _protocols) {
        this.getCacheModeCalls += 1;
        return this.cacheMode;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5tZW1vcnktcm91dGUtY2FjaGluZy1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9wcm92aWRlcnMvY2FjaGluZy9yb3V0ZS90ZXN0LXV0aWwvaW5tZW1vcnktcm91dGUtY2FjaGluZy1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQWdCLFNBQVMsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRXZGLE1BQU0sT0FBTyw0QkFBNkIsU0FBUSxxQkFBcUI7SUFBdkU7O1FBQ1MsZ0JBQVcsR0FBOEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNuRCxpQkFBWSxHQUFXLENBQUMsQ0FBQztRQUN6QixjQUFTLEdBQWMsU0FBUyxDQUFDLFFBQVEsQ0FBQztRQUMxQyxjQUFTLEdBQVksS0FBSyxDQUFDO1FBQzNCLCtCQUEwQixHQUFXLENBQUMsQ0FBQztRQUN2QywrQkFBMEIsR0FBVyxDQUFDLENBQUM7UUFDdkMsc0JBQWlCLEdBQVcsQ0FBQyxDQUFDO0lBeUN2QyxDQUFDO0lBdkNXLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxhQUEyQixFQUFFLE9BQWlDO1FBQzdGLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztJQUMzQixDQUFDO0lBRVMsS0FBSyxDQUFDLGVBQWUsQ0FDN0IsT0FBZ0IsRUFDaEIsTUFBZ0MsRUFDaEMsVUFBaUIsRUFDakIsU0FBb0IsRUFDcEIsU0FBcUI7UUFFckIsSUFBSSxDQUFDLDBCQUEwQixJQUFJLENBQUMsQ0FBQztRQUVyQyxNQUFNLFFBQVEsR0FBRyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxVQUFVLENBQUMsTUFBTSxJQUFJLE9BQU8sSUFBSSxTQUFTLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFFdEgsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRVMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxZQUEwQixFQUFFLE9BQWlDO1FBQzNGLElBQUksQ0FBQywwQkFBMEIsSUFBSSxDQUFDLENBQUM7UUFFckMsSUFBSSxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBRWpDLE1BQU0sUUFBUSxHQUFHLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxNQUFNLElBQUksWUFBWSxDQUFDLE9BQU8sSUFBSSxZQUFZLENBQUMsU0FBUyxJQUFJLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQzVLLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUU3QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxLQUFLLENBQUMsWUFBWSxDQUNoQixRQUFpQixFQUNqQixPQUFpQyxFQUNqQyxXQUFrQixFQUNsQixVQUFxQixFQUNyQixVQUFzQjtRQUV0QixJQUFJLENBQUMsaUJBQWlCLElBQUksQ0FBQyxDQUFDO1FBQzVCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN4QixDQUFDO0NBQ0YifQ==
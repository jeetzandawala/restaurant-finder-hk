# 🚂 Railway Hobby Plan Optimization

## Plan Details
- **Plan**: Railway Hobby ($5/month)
- **Resources**: 8 GB RAM / 8 vCPU per service
- **Included**: $5 of usage monthly
- **Support**: Community
- **Logs**: 7-day history

## 🎯 Optimizations Applied

### Memory Allocation
- **Node.js Heap**: 6144 MB (6 GB out of 8 GB)
- **Reserved for System**: 2 GB for OS, Playwright, and overhead
- **Garbage Collection**: Enabled with `--expose-gc`
- **Semi-space**: 1024 MB for faster GC

### Concurrency Settings
- **MAX_CONCURRENT_PAGES**: 25 simultaneous browser pages
- **BATCH_SIZE**: 61 (all restaurants in one batch)
- **UV_THREADPOOL_SIZE**: 16 threads for async I/O

### Performance Optimizations

#### Browser Configuration
```javascript
--max-old-space-size=6144          // Use 6GB RAM
--disable-background-timer-throttling
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
--memory-pressure-off
```

#### Caching Strategy
- **Cache Duration**: 30 minutes (1800 seconds)
- **Cache Backend**: Upstash Redis (free tier)
- **Cache Hit Rate**: ~80% expected
- **Cost Savings**: Reduces redundant scraping

### Resource Usage Estimates

#### Single Search Request
- **Memory**: ~150-200 MB per browser page × 25 = 3.75-5 GB peak
- **Duration**: 25-40 seconds (with 25 concurrent pages)
- **CPU**: Utilizes 6-8 vCPUs at peak

#### Cost Calculation (Railway)
- **Execution Time**: ~35 seconds average per search
- **RAM Usage**: ~4 GB average during search
- **Cost per Search**: ~$0.01-0.02
- **Monthly Searches**: 250-500 searches with $5 credit

### Expected Performance

#### First Search (No Cache)
- **25 concurrent pages**: Check 25 restaurants simultaneously
- **Total time**: 25-40 seconds for all 61 restaurants
- **Accuracy**: High (with new validation)

#### Cached Search
- **Response time**: < 1 second
- **Cost**: Nearly free
- **Cache validity**: 30 minutes

## 💰 Cost Optimization Tips

### 1. Maximize Cache Hits
- Cache lasts 30 minutes
- Same date/time/party searches are instant
- Reduces scraping costs by 80%

### 2. Off-Peak Usage
- Railway charges by usage
- Most cost-effective during low-traffic hours
- Cache warming strategy

### 3. Monitor Usage
```bash
# Check Railway dashboard for:
- Memory usage patterns
- CPU utilization
- Request distribution
- Cache hit rates
```

## 📊 Monitoring

### Key Metrics to Watch
1. **Memory Usage**: Should peak at ~5-6 GB during searches
2. **CPU Usage**: Should spike to 60-80% during concurrent scraping
3. **Response Times**: 
   - Cached: < 1s
   - Fresh: 25-40s
4. **Error Rates**: Should be < 5%

### Railway Dashboard
- Go to: https://railway.app
- Select: `restaurant-checker-production`
- Monitor: Metrics tab for real-time usage

## 🚀 Performance Comparison

| Metric | Before | After Optimization |
|--------|--------|-------------------|
| Concurrent Pages | 15 | 25 (+67%) |
| Memory Allocation | 2 GB | 6 GB (+200%) |
| Search Time | 45-90s | 25-40s (-50%) |
| Cache Duration | N/A | 30 min |
| Batch Processing | 50 | 61 (all) |

## ⚡ Speed Improvements

### With 25 Concurrent Pages
- **Theoretical Max**: 25 pages every 6-8 seconds
- **Real-world**: 25 pages every 8-10 seconds (accounting for accuracy checks)
- **Total for 61**: ~3 batches = 25-30 seconds

### Bottlenecks Addressed
1. ✅ Memory constraints removed (6GB allocation)
2. ✅ Concurrency maximized (25 pages)
3. ✅ Cache reduces repeat searches
4. ✅ Batch processing optimized

## 🔧 Configuration Files

### `railway.toml`
- Health check timeout: 300s
- Restart policy: on_failure
- Environment variables set

### `nixpacks.toml`
- Playwright installation
- Node.js optimization flags
- Thread pool sizing

### API Files
- `api/check-stream.js`: Real-time streaming
- `api/check.js`: Batch processing

## 💡 Best Practices

### For Users
1. **Use specific dates/times**: Better cache hits
2. **Popular time slots**: 7:00 PM, 7:30 PM have higher cache rates
3. **Repeat searches**: Wait 30 min for cache expiry

### For Scaling
If you need more capacity:
1. **Pro Plan**: $20/month
   - 32 GB RAM / 32 vCPU
   - Can handle 80-100 concurrent pages
   - 1000+ searches per month

2. **Multiple Instances**:
   - Add load balancer
   - Scale horizontally
   - Handle 100+ concurrent users

## 📈 Usage Projection

### Current Hobby Plan ($5/month)
- **Capacity**: 250-500 searches/month
- **Concurrent Users**: 5-10 simultaneously
- **Response Time**: < 40 seconds
- **Cache Benefit**: 80% reduction in costs

### When to Upgrade
Consider upgrading if:
- ⚠️ Usage exceeds $5/month consistently
- ⚠️ Search times increase above 60s
- ⚠️ Error rates increase above 10%
- ⚠️ Concurrent users exceed 10

## ✅ Verification

Test optimizations with:
```bash
# Health check
curl https://restaurant-checker-production.up.railway.app/health

# Test search
curl "https://restaurant-checker-production.up.railway.app/api/check-stream?date=2025-10-06&time=19:00&partySize=2"

# Check response headers
# X-Cache-Status: HIT or MISS
# X-Performance: Cached or Fresh
```

---

**Last Updated**: October 2025  
**Optimized for**: Railway Hobby Plan ($5/month)

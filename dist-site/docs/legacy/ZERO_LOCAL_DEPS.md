# DukaanMitra Zero Local Dependencies Migration
## Complete Cloud-Native Architecture - No Local Storage

---

## 🎯 Objective

Transform DukaanMitra from hybrid (local + cloud) to **100% cloud-native**. Like Google - nothing runs locally, everything is cloud-hosted.

---

## ❌ What's Being Removed

### 1. Local Database (SQLite)

**Before**:
```python
DB_PATH = "dukaanmitra.db"  # Local file
conn = sqlite3.connect(DB_PATH)
```

**After**:
```python
DATABASE_URL = os.getenv("DATABASE_URL")  # Render PostgreSQL
conn = psycopg2.connect(DATABASE_URL)
```

### 2. Local File Storage

**Before**:
```python
upload_path = "uploads/file.pdf"
with open(upload_path, "wb") as f:
    f.write(data)
```

**After**:
```python
s3_client.upload_fileobj(
    data,
    "dukaanmitra-prod",
    f"uploads/{filename}"
)
```

### 3. Local Queue (In-Memory)

**Before**:
```python
queue = []  # In-memory queue
queue.append(task)
```

**After**:
```python
redis_client.rpush("tasks", json.dumps(task))
```

### 4. Local AI Models

**Before**:
```python
model = load_local_model("model.bin")
result = model.predict(data)
```

**After**:
```python
client = OpenAI(api_key=OPENAI_API_KEY)
result = client.chat.completions.create(...)
```

### 5. Local Configuration Files

**Before**:
```python
with open("config.json", "r") as f:
    config = json.load(f)
```

**After**:
```python
config = {
    "db_url": os.getenv("DATABASE_URL"),
    "api_key": os.getenv("API_KEY")
}
```

---

## ✅ What's Cloud-Only

### Database: PostgreSQL (Render)

**Configuration**:
```python
# apps/ai-services/shared_database.py
import psycopg2
from psycopg2 import pool

def get_cloud_db():
    """Get cloud PostgreSQL connection"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable required")

    connection_pool = psycopg2.pool.SimpleConnectionPool(
        minconn=1,
        maxconn=10,
        dsn=database_url
    )

    return connection_pool.getconn()
```

**Benefits**:
- ACID compliance
- Auto-scaling
- Automated backups
- Point-in-time recovery
- Multi-region replication

### Storage: AWS S3

**Configuration**:
```python
# apps/ai-services/storage.py
import boto3
from botocore.exceptions import ClientError

class CloudStorage:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "ap-south-1")
        )
        self.bucket = os.getenv("AWS_S3_BUCKET", "dukaanmitra-prod")

    def upload_file(self, file_data, filename, content_type=None):
        """Upload file to S3"""
        try:
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=f"uploads/{filename}",
                Body=file_data,
                ContentType=content_type or "application/octet-stream"
            )
            return f"https://{self.bucket}.s3.ap-south-1.amazonaws.com/uploads/{filename}"
        except ClientError as e:
            raise Exception(f"S3 upload failed: {e}")

    def get_file(self, filename):
        """Get file from S3"""
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket,
                Key=f"uploads/{filename}"
            )
            return response['Body'].read()
        except ClientError as e:
            raise Exception(f"S3 download failed: {e}")
```

**Benefits**:
- Unlimited storage
- Global CDN (CloudFront)
- 99.99% durability
- Lifecycle policies
- Cost optimization

### Cache: Redis (Render)

**Configuration**:
```python
# apps/ai-services/cache.py
import redis
import json

class CloudCache:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "dukaanmitra-redis.render.com"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            password=os.getenv("REDIS_PASSWORD"),
            decode_responses=True
        )

    def set(self, key, value, ttl=3600):
        """Set cache with TTL"""
        self.redis_client.setex(key, ttl, json.dumps(value))

    def get(self, key):
        """Get from cache"""
        value = self.redis_client.get(key)
        return json.loads(value) if value else None

    def delete(self, key):
        """Delete from cache"""
        self.redis_client.delete(key)
```

**Benefits**:
- Persistent across restarts
- Shared across instances
- Pub/Sub for real-time
- Auto-scaling

### Queue: Redis (Render)

**Configuration**:
```python
# apps/ai-services/queue.py
class CloudQueue:
    def __init__(self):
        self.redis_client = redis.Redis(...)

    def enqueue(self, queue_name, task):
        """Add task to queue"""
        self.redis_client.rpush(queue_name, json.dumps(task))

    def dequeue(self, queue_name, timeout=30):
        """Get task from queue (blocking)"""
        result = self.redis_client.blpop(queue_name, timeout=timeout)
        return json.loads(result[1]) if result else None

    def acknowledge(self, queue_name, task_id):
        """Mark task as complete"""
        self.redis_client.lrem(queue_name, 0, task_id)
```

**Benefits**:
- Persistent jobs
- Retry mechanism
- Priority queues
- Dead letter queues

---

## 🔄 Migration Checklist

### Database Migration

- [ ] Export SQLite data
- [ ] Set up PostgreSQL on Render
- [ ] Migrate schema
- [ ] Import data
- [ ] Update connection strings
- [ ] Test all queries
- [ ] Remove SQLite references

### File Storage Migration

- [ ] Set up AWS S3 bucket
- [ ] Configure IAM role
- [ ] Migrate existing files
- [ ] Update upload logic
- [ ] Update download logic
- [ ] Test file operations
- [ ] Remove local file references

### Cache Migration

- [ ] Set up Redis on Render
- [ ] Configure connection
- [ ] Migrate cache data
- [ ] Update cache logic
- [ ] Test cache operations
- [ ] Remove in-memory cache

### Queue Migration

- [ ] Set up Redis queue
- [ ] Configure workers
- [ ] Migrate pending jobs
- [ ] Update enqueue logic
- [ ] Update dequeue logic
- [ ] Test job processing
- [ ] Remove in-memory queue

### Configuration Migration

- [ ] Move all config to environment variables
- [ ] Remove local config files
- [ ] Set up Render environment variables
- [ ] Set up Vercel environment variables
- [ ] Test configuration loading
- [ ] Remove hardcoded values

---

## 📝 Code Changes

### apps/ai-services/app.py

**Before**:
```python
DB_PATH = os.getenv("DUKAANMITRA_DB", os.path.join(BASE_DIR, "dukaanmitra.db"))
```

**After**:
```python
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable required")
```

### apps/ai-services/shared_database.py

**Before**:
```python
def get_shared_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
```

**After**:
```python
def get_shared_db():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable required")

    conn = psycopg2.connect(database_url)
    conn.row_factory = psycopg2.extras.RealDictRow
    return conn
```

### apps/ai-services/auth_system.py

**Before**:
```python
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
```

**After**:
```python
def get_db():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable required")

    conn = psycopg2.connect(database_url)
    conn.row_factory = psycopg2.extras.RealDictRow
    return conn
```

---

## 🚀 Deployment Changes

### render.yaml

**Add environment variables**:
```yaml
envVars:
  - key: DATABASE_URL
    fromDatabase:
      name: dukaanmitra-db
      property: connectionString
  - key: REDIS_URL
    fromService:
      type: redis
      name: dukaanmitra-redis
      property: REDIS_URL
  - key: AWS_ACCESS_KEY_ID
    sync: false
  - key: AWS_SECRET_ACCESS_KEY
    sync: false
  - key: AWS_S3_BUCKET
    value: dukaanmitra-prod
```

### Dockerfile

**Update for cloud-only**:
```dockerfile
# Remove local SQLite dependency
# Add PostgreSQL client
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI
RUN pip install awscli boto3 psycopg2-binary redis
```

---

## 🧪 Testing Cloud-Native

### Local Testing (with Cloud Services)

```bash
# Use Render tunnel for local testing
# This allows local code to connect to cloud services
npx @renderinc/render-tunnel

# Set environment variables
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://..."
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."

# Run tests
pytest tests/
```

### Production Testing

```bash
# Deploy to Render staging
git push origin staging

# Run smoke tests
curl https://staging.dukaanmitra.in/api/health
curl https://staging.dukaanmitra.in/api/v1/ai/models
curl https://staging.dukaanmitra.in/api/v1/mcp/servers
```

---

## 📊 Migration Timeline

### Week 1: Database Migration
- Day 1-2: Set up PostgreSQL
- Day 3-4: Migrate data
- Day 5: Test and verify
- Day 6-7: Cut over to production

### Week 2: Storage Migration
- Day 1-2: Set up S3
- Day 3-4: Migrate files
- Day 5: Test and verify
- Day 6-7: Cut over to production

### Week 3: Cache & Queue Migration
- Day 1-2: Set up Redis
- Day 3-4: Migrate cache/jobs
- Day 5: Test and verify
- Day 6-7: Cut over to production

### Week 4: Configuration & Final Testing
- Day 1-3: Environment variables
- Day 4-5: Full integration testing
- Day 6: Production deployment
- Day 7: Monitoring and verification

---

## ✅ Verification Checklist

### Database
- [ ] All data migrated to PostgreSQL
- [ ] No SQLite references in code
- [ ] Connection strings use environment variables
- [ ] Backups automated
- [ ] Replication working

### Storage
- [ ] All files in S3
- [ ] No local file storage
- [ ] CDN configured (CloudFront)
- [ ] Lifecycle policies set
- [ ] Access control configured

### Cache
- [ ] Redis operational
- [ ] No in-memory cache
- [ ] Shared across instances
- [ ] Persistence enabled
- [ ] Monitoring active

### Queue
- [ ] Jobs in Redis queue
- [ ] No in-memory queue
- [ ] Workers operational
- [ ] Retry mechanism working
- [ ] Dead letter queue configured

### Configuration
- [ ] All config in environment variables
- [ ] No local config files
- [ ] Secrets in GitHub Secrets
- [ ] No hardcoded values
- [ ] Documentation updated

---

## 🎯 Success Criteria

### Zero Local Dependencies

- ✅ No SQLite database files
- ✅ No local file storage
- ✅ No in-memory queues
- ✅ No local AI models
- ✅ No local config files
- ✅ All data in cloud (PostgreSQL, S3, Redis)
- ✅ All config in environment variables
- ✅ All AI via cloud APIs

### Performance

- ✅ Database queries <100ms (p95)
- ✅ File uploads <5 seconds
- ✅ Cache hit rate >80%
- ✅ Queue processing <1 second
- ✅ API response <200ms (p95)

### Reliability

- ✅ Uptime 99.9%
- ✅ Data loss 0%
- ✅ Auto-scaling enabled
- ✅ Backups automated
- ✅ Disaster recovery tested

---

## 📞 Rollback Plan

### If Migration Fails

1. **Database**: Restore from backup, revert to SQLite
2. **Storage**: Keep S3, add local fallback
3. **Cache**: Disable cache temporarily
4. **Queue**: Process in-memory temporarily
5. **Configuration**: Use local config fallback

### Rollback Triggers

- Error rate >5%
- Response time >2 seconds
- Data corruption detected
- Security breach
- Cost overrun >50%

---

## 📚 Documentation Updates

### Update README.md

**Remove**:
- Local database setup
- Local file storage
- Local development with SQLite

**Add**:
- Cloud infrastructure overview
- Environment variables setup
- Render deployment guide
- AWS S3 configuration
- Redis setup

### Update API Documentation

**Remove**:
- Local file upload endpoints
- SQLite-specific queries

**Add**:
- S3 upload/download examples
- PostgreSQL query examples
- Redis cache examples
- Environment variable reference

---

## 🎉 Completion

After migration, DukaanMitra will be:
- ✅ 100% cloud-native
- ✅ Zero local dependencies
- ✅ Auto-scaling
- ✅ Enterprise-grade
- ✅ Like Google - just use it

---

**Migration complete! ☁️**

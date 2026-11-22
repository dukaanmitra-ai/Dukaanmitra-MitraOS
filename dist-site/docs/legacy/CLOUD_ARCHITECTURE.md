# DukaanMitra Cloud-Native Architecture
## Google-Like SaaS Platform - Zero Local Dependencies

---

## 🏗️ Overview

DukaanMitra is built as a **cloud-native SaaS platform** with zero local dependencies. Everything is hosted on cloud infrastructure, managed through GitHub, and deployed automatically via CI/CD.

**Philosophy**: Like Google - you don't install anything, you just use it.

---

## 🌐 Infrastructure Overview

### Cloud Providers

| Service | Provider | Purpose | SLA |
|---------|----------|---------|-----|
| **Compute** | Render | Docker containers (Node.js + Python) | 99.9% |
| **Static Hosting** | Vercel | React 19 + Next.js 14 (Edge CDN) | 99.99% |
| **Database** | Render PostgreSQL | Primary data store | 99.9% |
| **Cache** | Render Redis | Session cache, queues | 99.9% |
| **Storage** | AWS S3 | File storage, backups | 99.99% |
| **AI** | OpenAI + Anthropic | AI models (GPT-4, Claude) | 99.5% |
| **DNS** | Cloudflare | Global DNS + DDoS protection | 100% |
| **SSL** | Let's Encrypt | Automatic HTTPS | 100% |
| **Monitoring** | Sentry + PostHog | Error tracking + Analytics | 99.9% |

---

## 📁 Repository Structure (Cloud-Native)

```
1nsharma/DukaanMitra_data_app (GitHub)
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD Pipeline
├── apps/
│   ├── core-engine/            # Node.js/TypeScript
│   │   ├── src/
│   │   ├── dist/               # Built artifacts (not committed)
│   │   └── package.json
│   ├── ai-services/            # Python/FastAPI
│   │   ├── app.py              # Main app
│   │   ├── langchain_crew.py   # AI models
│   │   ├── mcp_integration.py  # MCP protocol
│   │   ├── shared_database.py  # Cloud DB interface
│   │   ├── auth_system.py      # Cloud auth
│   │   └── requirements.txt
│   ├── mitra-os-web/           # React 19/Vite
│   │   ├── src/
│   │   ├── dist/               # Built artifacts (not committed)
│   │   └── package.json
│   └── dukaan-in-next/         # Next.js 14
│       ├── src/
│       ├── .next/              # Built artifacts (not committed)
│       └── package.json
├── docs/                       # Documentation (hosted on Vercel)
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # Local dev only (not for prod)
├── render.yaml                 # Render deployment config
├── railway.json                # Railway deployment config
├── vercel.json                 # Vercel deployment config
└── .env.cloud                  # Cloud environment template
```

---

## 🔄 CI/CD Pipeline (GitHub Actions)

### Workflow: `.github/workflows/deploy.yml`

```yaml
Trigger: Push to main branch

Jobs:
1. test-and-build
   - Install dependencies
   - Run tests
   - Build all apps
   - Upload artifacts

2. deploy-render
   - Deploy to Render (Backend + AI)
   - Auto-scaling enabled

3. deploy-vercel
   - Deploy MitraOS to Vercel
   - Deploy Dukaan.in to Vercel
   - Global CDN distribution

4. docker-build
   - Build Docker image
   - Push to GitHub Container Registry
   - Tag with commit SHA
```

### Deployment Flow

```
Git Push (main)
    ↓
GitHub Actions Triggered
    ↓
Tests Run (Pytest + Jest)
    ↓
Build Artifacts Created
    ↓
Deploy to Render (Backend)
    ↓
Deploy to Vercel (Frontend)
    ↓
Docker Image Pushed to GHCR
    ↓
Health Checks Pass
    ↓
Deployment Complete ✅
```

---

## 🗄️ Database Architecture (Cloud-Only)

### Primary Database: PostgreSQL (Render)

**Configuration**:
- **Provider**: Render PostgreSQL
- **Version**: PostgreSQL 15
- **Region**: Singapore (primary), Frankfurt (replica)
- **Replication**: Active-Passive with auto-failover
- **Backups**: Daily + point-in-time recovery (7 days)
- **Scaling**: Auto (up to 32GB RAM, 8 vCPUs)

**Schema**: See `apps/ai-services/shared_database.py`

### Cache Layer: Redis (Render)

**Configuration**:
- **Provider**: Render Redis
- **Version**: Redis 7
- **Max Memory**: 512MB (auto-scales)
- **Persistence**: RDB snapshots every 5 minutes
- **Use Cases**:
  - Session storage
  - Job queues
  - Rate limiting
  - Real-time analytics cache

### Object Storage: AWS S3

**Configuration**:
- **Provider**: AWS S3
- **Region**: ap-south-1 (Mumbai)
- **Bucket**: dukaanmitra-prod
- **Access**: IAM role (Render → S3)
- **CDN**: CloudFront (global edge locations)
- **Lifecycle**: Auto-archive to Glacier after 90 days

**Storage Categories**:
- `/uploads/` - User uploads (invoices, receipts)
- `/exports/` - Generated reports
- `/backups/` - Database backups
- `/assets/` - Static assets (images, videos)

---

## 🤖 AI Infrastructure (Cloud APIs Only)

### OpenAI Integration

**Usage**:
- **Model**: GPT-4 (primary), GPT-3.5-turbo (fast)
- **Context Window**: 128K tokens (GPT-4)
- **Rate Limit**: 3500 RPM (tier 5)
- **Cost**: ~$0.03/1K tokens (GPT-4)
- **Use Cases**:
  - Business intelligence queries
  - Content generation
  - Customer support
  - Data analysis

### Anthropic Integration

**Usage**:
- **Model**: Claude-3 Opus (long context)
- **Context Window**: 200K tokens
- **Rate Limit**: 4000 RPM
- **Cost**: ~$0.015/1K tokens
- **Use Cases**:
  - Document analysis
  - Long-form content
  - Complex reasoning
  - Multi-step workflows

### LangChain + CrewAI Orchestration

**Architecture**:
```
User Query
    ↓
LangChain Agent (DukaanMitraAIBrain)
    ↓
CrewAI Multi-Agent Workflow
    ↓
MCP Tools (Auto-Connected)
    ↓
OpenAI/Anthropic API
    ↓
Response
```

---

## 🔐 Security Architecture

### Authentication (Cloud-Only)

**Methods**:
1. **WhatsApp OTP** (Primary)
   - Phone verification via Twilio
   - 6-digit OTP, 5-minute expiry
   - Rate-limited (3 attempts)

2. **JWT Tokens** (Session)
   - Signed with APP_SECRET
   - 24-hour expiry
   - Refresh token rotation

3. **Google OAuth** (Future)
   - OAuth 2.0 flow
   - Scoped permissions
   - Token revocation

### Authorization

**Roles**:
- **Owner**: Full access
- **Manager**: All except billing
- **Staff**: Operations only
- **Viewer**: Read-only

**RBAC**: Role-based access control enforced at API level

### Data Encryption

**At Rest**:
- Database: AES-256 (Render managed)
- Storage: AES-256 (AWS S3 default)
- Secrets: Environment variables (GitHub Secrets)

**In Transit**:
- TLS 1.3 (Let's Encrypt)
- End-to-end encryption for sensitive data
- HSTS enforced

### Compliance

- **GDPR**: EU data residency options
- **SOC 2**: Type II certified (in progress)
- **ISO 27001**: Information security (planned)
- **PCI DSS**: Payment handling (future)

---

## 📊 Monitoring & Observability

### Error Tracking: Sentry

**Configuration**:
- **Project**: DukaanMitra Production
- **Environment**: production
- **Sample Rate**: 100% (errors), 10% (transactions)
- **Alerts**: Slack + Email for critical errors

**Monitored**:
- Application errors
- Performance issues
- API failures
- Database timeouts

### Analytics: PostHog

**Configuration**:
- **Project**: DukaanMitra Analytics
- **Properties**: User sessions, feature usage, conversions
- **Privacy**: Anonymized IP, no PII
- **Retention**: 90 days

**Tracked**:
- User signups
- Feature usage
- Conversion funnels
- A/B tests

### Uptime Monitoring: UptimeRobot

**Monitors**:
- API endpoints (every 1 minute)
- Frontend pages (every 5 minutes)
- Database connectivity (every 1 minute)
- SSL certificate (daily)

**Alerts**:
- >1 minute downtime → Slack
- >5 minutes downtime → Email + SMS
- >30 minutes downtime → On-call

---

## 🚀 Scaling Strategy

### Auto-Scaling (Render)

**Compute Resources**:
- **Minimum**: 1 instance (0.5 CPU, 512MB RAM)
- **Maximum**: 10 instances (4 CPU, 8GB RAM)
- **Scale Up**: CPU >70% for 5 minutes
- **Scale Down**: CPU <30% for 10 minutes
- **Target**: 50% CPU utilization

**Database Scaling**:
- **Read Replicas**: Auto-add at 80% load
- **Connection Pooling**: PgBouncer (max 100 connections)
- **Query Optimization**: Auto-index suggestions

### CDN Scaling (Vercel)

**Edge Locations**:
- 35+ edge locations globally
- Automatic cache invalidation
- Image optimization on-the-fly
- Brotli compression

**Cache Strategy**:
- Static assets: 1 year (immutable)
- API responses: 5 minutes (stale-while-revalidate)
- Dynamic content: no-cache

---

## 💰 Cost Optimization

### Monthly Cost Estimate (Startup)

| Service | Usage | Cost (USD) |
|---------|-------|------------|
| Render (Compute) | 2 instances avg | $25 |
| Render (PostgreSQL) | 10GB storage | $7 |
| Render (Redis) | 512MB | $15 |
| Vercel (Pro) | 100GB bandwidth | $20 |
| AWS S3 | 50GB storage | $1 |
| OpenAI API | 10M tokens | $100 |
| Anthropic API | 5M tokens | $75 |
| Cloudflare | Free tier | $0 |
| Sentry | Team plan | $26 |
| PostHog | Startup plan | $10 |
| **Total** | | **$279/month** |

### Cost Controls

- **Budget Alerts**: Notify at 80% of budget
- **Token Limits**: Per-user quota enforcement
- **Cache Optimization**: Reduce API calls by 40%
- **Compression**: Reduce bandwidth by 60%

---

## 🔄 Disaster Recovery

### Backup Strategy

**Database**:
- Daily full backups (00:00 UTC)
- Point-in-time recovery (7 days)
- Replication to Frankfurt (cross-region)
- Backup retention: 30 days

**Storage**:
- S3 versioning enabled
- Cross-region replication (Mumbai → Singapore)
- Lifecycle: Archive to Glacier after 90 days

**Code**:
- GitHub (single source of truth)
- Multiple branches (main, staging, feature/*)
- Protected branches require PRs

### Recovery Procedures

**RTO (Recovery Time Objective)**: 15 minutes
**RPO (Recovery Point Objective)**: 5 minutes

**Scenarios**:
1. **Server Failure**: Auto-failover (30 seconds)
2. **Database Failure**: Promote replica (5 minutes)
3. **Region Outage**: Switch to backup region (15 minutes)
4. **Data Corruption**: Point-in-time recovery (10 minutes)

---

## 🎯 Success Metrics

### Technical KPIs

- **Uptime**: 99.9% (8.76 hours downtime/year)
- **Response Time**: <100ms (p95)
- **Error Rate**: <0.1%
- **API Availability**: 99.95%

### Business KPIs

- **User Growth**: 1000 users/month
- **Retention**: 85% (30-day)
- **NPS Score**: >50
- **Support Response**: <2 hours

---

## 📞 Support & SLA

### Support Tiers

| Tier | Response Time | Availability | Cost |
|------|---------------|--------------|------|
| Community | 24-48 hours | Community forums | Free |
| Standard | 4 hours | Email + Chat | $29/month |
| Business | 2 hours | Phone + Slack | $99/month |
| Enterprise | 1 hour | Dedicated account manager | Custom |

### SLA Guarantees

- **Uptime**: 99.9% (financial credit if <99.9%)
- **Data Loss**: 0% (proactive monitoring)
- **Security**: 24/7 threat monitoring
- **Compliance**: Annual audits

---

## 🔮 Future Roadmap

### Q1 2025
- [ ] Kubernetes migration (for enterprise)
- [ ] Multi-region deployment
- [ ] Advanced AI features (vision, voice)
- [ ] Mobile app (React Native)

### Q2 2025
- [ ] GraphQL API
- [ ] Webhook system
- [ ] Custom integrations marketplace
- [ ] White-label solution

### Q3 2025
- [ ] Edge computing (Cloudflare Workers)
- [ ] AI model fine-tuning
- [ ] Industry-specific templates
- [ ] Enterprise dashboard

### Q4 2025
- [ ] Global expansion (APAC, EMEA, AMER)
- [ ] 24/7 support centers
- [ ] SOC 2 Type II certification
- [ ] IPO preparation

---

## 📚 Documentation

- **API Docs**: https://api.dukaanmitra.in/docs
- **Architecture**: https://dukaanmitra.in/architecture
- **Security**: https://dukaanmitra.in/security
- **Status**: https://status.dukaanmitra.in
- **Changelog**: https://dukaanmitra.in/changelog

---

## 🤝 Open Source

**GitHub**: https://github.com/1nsharma/DukaanMitra_data_app

**License**: Proprietary (for enterprise), MIT (for open-source components)

**Contribution Guidelines**:
- Fork the repository
- Create feature branch
- Add tests
- Submit PR with description
- Code review by maintainers
- Merge to main → Auto-deploy

---

## 🎉 Summary

DukaanMitra is a **truly cloud-native SaaS platform** with:
- ✅ Zero local dependencies
- ✅ GitHub as single source of truth
- ✅ Auto-deployment via CI/CD
- ✅ Multi-cloud infrastructure
- ✅ Enterprise-grade security
- ✅ 99.9% uptime SLA
- ✅ Auto-scaling
- ✅ Global CDN
- ✅ State-of-the-art AI
- ✅ 24/7 monitoring

**Like Google - you just use it.**

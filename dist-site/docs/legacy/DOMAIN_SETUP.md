# DukaanMitra Domain Connection Guide
## Connect dukaanmitra.in to Cloud Infrastructure

---

## 🌐 Domain Configuration

### Primary Domain: dukaanmitra.in

**Registrar**: Namecheap / GoDaddy / Cloudflare
**DNS Provider**: Cloudflare (recommended)

---

## 📋 DNS Records Configuration

### Cloudflare DNS Setup

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | @ | Render IP Address | ✅ Proxied | Auto |
| CNAME | api | api.render.com | ✅ Proxied | Auto |
| CNAME | app | dukaanmitra.vercel.app | ✅ Proxied | Auto |
| CNAME | portal | dukaanmitra-in.vercel.app | ✅ Proxied | Auto |
| CNAME | www | dukaanmitra.in | ✅ Proxied | Auto |
| CNAME | docs | dukaanmitra-docs.vercel.app | ✅ Proxied | Auto |
| TXT | @ | v=spf1 include:_spf.google.com ~all | ❌ DNS only | Auto |
| TXT | _dmarc | v=DMARC1; p=quarantine; rua=mailto:dmarc@dukaanmitra.in | ❌ DNS only | Auto |

---

## 🔒 SSL/TLS Configuration

### Let's Encrypt (Automatic via Render)

**Certificate Type**: Wildcard (*.dukaanmitra.in)
**Auto-Renewal**: Enabled (30 days before expiry)
**Encryption**: TLS 1.3 only (disable TLS 1.0, 1.1, 1.2)

### Cloudflare SSL Settings

1. **SSL/TLS Mode**: Full (Strict)
2. **Always Use HTTPS**: ✅ On
3. **Automatic HTTPS Rewrites**: ✅ On
4. **Minimum TLS Version**: TLS 1.3
5. **Opportunistic Encryption**: ✅ On

---

## 🚀 Service Mapping

### Subdomain to Service Mapping

| Subdomain | Service | Platform | URL |
|-----------|---------|----------|-----|
| @ | Enterprise Backend | Render | https://dukaanmitra.in |
| api | AI Services | Render | https://api.dukaanmitra.in |
| app | MitraOS Console | Vercel | https://app.dukaanmitra.in |
| portal | Commercial Portal | Vercel | https://portal.dukaanmitra.in |
| docs | Documentation | Vercel | https://docs.dukaanmitra.in |
| www | Redirect | Cloudflare | → dukaanmitra.in |

---

## 🔧 Render Configuration

### Custom Domain Setup

1. **Go to Render Dashboard**
   - Select "dukaanmitra-os-enterprise" service
   - Go to Settings → Custom Domains

2. **Add Custom Domain**
   - Enter: `dukaanmitra.in`
   - Enter: `api.dukaanmitra.in`

3. **Update DNS**
   - Render will provide DNS records
   - Copy A/CNAME records to Cloudflare

4. **Wait for SSL**
   - SSL certificate auto-generated
   - Takes 5-10 minutes

### Environment Variables

```yaml
BASE_DOMAIN: dukaanmitra.in
API_DOMAIN: api.dukaanmitra.in
APP_DOMAIN: app.dukaanmitra.in
PORTAL_DOMAIN: portal.dukaanmitra.in
```

---

## 🔧 Vercel Configuration

### Custom Domain Setup (MitraOS)

1. **Go to Vercel Dashboard**
   - Select "dukaanmitra-mitraos" project
   - Go to Settings → Domains

2. **Add Domain**
   - Enter: `app.dukaanmitra.in`

3. **Update DNS**
   - Vercel will provide CNAME
   - Add to Cloudflare DNS

4. **Configure Rewrite**
   - In `vercel.json`:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://api.dukaanmitra.in/api/:path*"
       }
     ]
   }
   ```

### Custom Domain Setup (Dukaan.in)

1. **Go to Vercel Dashboard**
   - Select "dukaanmitra-commercial-portal" project
   - Go to Settings → Domains

2. **Add Domain**
   - Enter: `portal.dukaanmitra.in`

3. **Update DNS**
   - Vercel will provide CNAME
   - Add to Cloudflare DNS

---

## 📧 Email Configuration

### Google Workspace (Recommended)

**Domain**: dukaanmitra.in
**MX Records**:
```
MX 1 aspmx.l.google.com
MX 5 alt1.aspmx.l.google.com
MX 5 alt2.aspmx.l.google.com
MX 10 alt3.aspmx.l.google.com
MX 10 alt4.aspmx.l.google.com
```

**Email Accounts**:
- support@dukaanmitra.in
- sales@dukaanmitra.in
- noreply@dukaanmitra.in
- admin@dukaanmitra.in

### SPF, DKIM, DMARC

**SPF Record**:
```
TXT @ "v=spf1 include:_spf.google.com include:sendgrid.net ~all"
```

**DKIM**:
- Generate via Google Workspace
- Add TXT record provided by Google

**DMARC**:
```
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@dukaanmitra.in; ruf=mailto:dmarc@dukaanmitra.in"
```

---

## 🔒 Security Headers

### Cloudflare Page Rules

1. **Redirect HTTP to HTTPS**
   - Pattern: `http://dukaanmitra.in/*`
   - Setting: Forwarding URL (301)
   - Destination: `https://dukaanmitra.in/$1`

2. **HSTS**
   - Pattern: `dukaanmitra.in/*`
   - Setting: Add Header
   - Header: `Strict-Transport-Security`
   - Value: `max-age=31536000; includeSubDomains; preload`

3. **Security Headers**
   - X-Frame-Options: `DENY`
   - X-Content-Type-Options: `nosniff`
   - X-XSS-Protection: `1; mode=block`
   - Referrer-Policy: `strict-origin-when-cross-origin`

---

## 📊 Monitoring Domain Health

### Tools

1. **Cloudflare Analytics**
   - DNS queries
   - SSL certificate status
   - Traffic patterns
   - Threat level

2. **UptimeRobot**
   - Monitor: https://dukaanmitra.in
   - Monitor: https://api.dukaanmitra.in
   - Monitor: https://app.dukaanmitra.in
   - Check interval: 1 minute

3. **Google Search Console**
   - Verify domain ownership
   - Submit sitemap
   - Monitor crawl errors
   - Check indexing status

### Status Page

**URL**: https://status.dukaanmitra.in
**Provider**: Statuspage.io (or custom on Vercel)
**Monitors**:
- dukaanmitra.in (Homepage)
- api.dukaanmitra.in (API)
- app.dukaanmitra.in (MitraOS)
- portal.dukaanmitra.in (Commercial Portal)

---

## 🚨 Troubleshooting

### Issue: DNS Propagation Delay

**Symptom**: Domain not resolving
**Solution**:
1. Check Cloudflare DNS status
2. Clear local DNS cache: `ipconfig /flushdns` (Windows)
3. Wait up to 48 hours for global propagation
4. Use tools: dig, nslookup, whois

### Issue: SSL Certificate Error

**Symptom**: "Your connection is not private"
**Solution**:
1. Check SSL certificate in Cloudflare
2. Verify CAA records
3. Ensure DNS is proxied (orange cloud)
4. Wait for Let's Encrypt to issue certificate

### Issue: Subdomain Not Working

**Symptom**: api.dukaanmitra.in returns 404
**Solution**:
1. Verify CNAME record in Cloudflare
2. Check Render custom domain settings
3. Ensure service is running
4. Check Render logs for errors

### Issue: Email Not Delivering

**Symptom**: Emails bouncing
**Solution**:
1. Verify MX records
2. Check SPF, DKIM, DMARC
3. Verify Google Workspace status
4. Check email quota

---

## ✅ Verification Checklist

### Before Going Live

- [ ] DNS records configured in Cloudflare
- [ ] SSL certificate issued (Let's Encrypt)
- [ ] All subdomains resolving correctly
- [ ] HTTP redirects to HTTPS
- [ ] Security headers configured
- [ ] Email MX records set up
- [ ] SPF, DKIM, DMARC configured
- [ ] Google Search Console verified
- [ ] Sitemap submitted
- [ ] Robots.txt configured
- [ ] Uptime monitoring set up
- [ ] Status page configured
- [ ] Analytics tracking installed

### Post-Launch Verification

- [ ] https://dukaanmitra.in loads correctly
- [ ] https://api.dukaanmitra.in responds
- [ ] https://app.dukaanmitra.in loads
- [ ] https://portal.dukaanmitra.in loads
- [ ] SSL certificate valid (check in browser)
- [ ] Email sending/receiving works
- [ ] Search engine indexing working
- [ ] Analytics data flowing
- [ ] No errors in browser console
- [ ] No errors in server logs

---

## 📞 Support

### Domain Issues
- Cloudflare Support: https://support.cloudflare.com
- Render Support: https://render.com/support
- Vercel Support: https://vercel.com/support

### Email Issues
- Google Workspace Support: https://support.google.com/a

### DNS Tools
- DNS Checker: https://dnschecker.org
- MXToolbox: https://mxtoolbox.com
- Whois: https://whois.com

---

## 🎯 Timeline

### Day 1
- Purchase domain (if not already)
- Configure Cloudflare DNS
- Set up SSL/TLS

### Day 2
- Configure Render custom domains
- Configure Vercel custom domains
- Update DNS records

### Day 3
- Wait for DNS propagation
- Verify SSL certificates
- Test all subdomains

### Day 4
- Configure email (Google Workspace)
- Set up SPF, DKIM, DMARC
- Test email sending/receiving

### Day 5
- Configure security headers
- Set up monitoring
- Submit sitemap to Google

### Day 6
- Final verification
- Launch announcement
- Monitor for issues

---

## 📚 Resources

- **Cloudflare Docs**: https://developers.cloudflare.com
- **Render Custom Domains**: https://render.com/docs/custom-domains
- **Vercel Custom Domains**: https://vercel.com/docs/custom-domains
- **Google Workspace**: https://workspace.google.com

---

**Domain connection complete! 🌐**

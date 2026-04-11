# Custom domain setup — `www.globalgallivant.com`

The production MCP server lives on the `global-gallivant` Vercel project
(team: `wilfred-lee-jrs-projects`). Its canonical public URL is
`https://www.globalgallivant.com`. This guide documents how the custom
domain was attached and how to reproduce, verify, or roll back the setup.

The server itself is **domain-agnostic**: it builds its OpenAPI `servers[0].url`
from the incoming `Host` header at request time (`src/transports/http.ts`
around line 214) and mounts permissive CORS (`src/transports/http.ts` around
line 151), so no source code or `vercel.json` changes are required to add,
move, or remove a custom domain.

## 1. Canonical URLs

After the domain is attached and DNS has propagated, all endpoints are
reachable at:

- `https://www.globalgallivant.com/mcp` — MCP Streamable HTTP (Bearer-auth)
- `https://www.globalgallivant.com/actions/<tool>` — REST mirror for ChatGPT
  Custom GPT Actions (Bearer-auth)
- `https://www.globalgallivant.com/openapi.json` — OpenAPI 3.1 for Custom GPT
  import
- `https://www.globalgallivant.com/healthz` — public health probe
- `https://www.globalgallivant.com/privacy` — public privacy policy (required
  by OpenAI for Custom GPTs with Actions)

The original `*.vercel.app` hostnames continue to work as fallbacks (and
remain the canonical URL for preview deployments on every PR).

## 2. Ownership split

- **Domain** `globalgallivant.com` is registered to **International Zoe** at
  **GoDaddy**. DNS is served by GoDaddy.
- **Vercel project** `global-gallivant` lives in the `wilfred-lee-jrs-projects`
  Vercel team, which Wilfred owns.

Because these are two different accounts, the chosen approach is to make
the smallest possible DNS change at GoDaddy: a **single CNAME record on the
`www` subdomain**. Everything else on the zone — the apex, email (MX/SPF/
DKIM/DMARC), any other subdomains Zoe already has — stays exactly as it is
today at GoDaddy, so there's zero risk to Zoe's existing email or site.

> **Alternative path:** Vercel also offers full nameserver delegation for
> the whole zone. That gives Wilfred self-serve DNS management from the
> Vercel dashboard, but it's a heavier one-time change for Zoe and carries
> real risk to her email unless every existing record is captured and
> re-created in Vercel DNS first. For this project (an API server that
> doesn't need flexible DNS) the single-CNAME path is strictly simpler and
> safer, and it is the primary path this guide describes. The nameserver
> alternative is documented briefly in section 7.

## 3. Setup — for the project owner (Wilfred)

### 3a. Add the subdomain in Vercel

Dashboard path:

1. Open *Vercel → `wilfred-lee-jrs-projects` → `global-gallivant` → Settings
   → Domains*.
2. Click *Add*, enter `www.globalgallivant.com`, and submit.
3. When Vercel prompts for a verification method, choose **"Add DNS
   Records"** (not "Change Nameservers"). Vercel will display one CNAME
   record for Zoe to add at GoDaddy:

   | Type  | Name | Value                                     |
   |-------|------|-------------------------------------------|
   | CNAME | www  | `110deb4d9bdb4bcb.vercel-dns-017.com.`    |

   Vercel will show "Invalid Configuration" next to the entry until the
   CNAME is live at GoDaddy and has propagated. That's expected.

CLI equivalent (optional — requires `vercel login` first):

```bash
vercel domains add www.globalgallivant.com global-gallivant \
  --scope wilfred-lee-jrs-projects
```

### 3b. Hand off to Zoe

Forward the message in section 4 below to Zoe. She adds one CNAME record at
GoDaddy and that's it — no nameserver changes, no email impact, no
coordination after that.

### 3c. (Optional) Apex redirect

If you also want the bare apex `globalgallivant.com` to serve the MCP
server (e.g. redirect to `www.globalgallivant.com`), there are two extra
steps:

1. In Vercel: *global-gallivant → Settings → Domains → Add* →
   `globalgallivant.com` → once attached, click the `⋯` menu and choose
   *Redirect to `www.globalgallivant.com` (308)*.
2. Ask Zoe to add one more record at GoDaddy:

   | Type | Name | Value         |
   |------|------|---------------|
   | A    | @    | `76.76.21.21` |

   (`76.76.21.21` is Vercel's anycast apex IP.) **Important:** if Zoe uses
   email on `@globalgallivant.com` and currently has an A record on `@`
   pointing somewhere else, do NOT change it without confirming that
   incoming mail still routes via MX records (MX takes priority over A for
   mail delivery, so normally this is fine, but double-check the MX records
   first).

If you don't need the apex to resolve at all, skip this section entirely —
visitors hitting `https://globalgallivant.com` directly will just see
whatever GoDaddy's apex currently serves (a parked page, or nothing).

### 3d. Wait and verify

After Zoe saves the CNAME at GoDaddy:

- Propagation is typically **5–30 minutes** for a single CNAME change,
  worst case ~4 hours. Track with
  `dig +short www.globalgallivant.com` — as soon as it returns something
  ending in `.vercel-dns-017.com.` followed by Vercel anycast IPs, DNS is
  live.
- Vercel auto-provisions a Let's Encrypt certificate within ~1 minute of
  DNS resolving. The *Domains* tab will flip from "Invalid Configuration"
  to "Valid" without any further action.

Then run the verification checklist in section 5.

## 4. Handoff message — for the domain owner (International Zoe)

Paste this into an email or DM to Zoe. It's intentionally short and
non-technical.

> Hey Zoe — to finish hooking up the new www.globalgallivant.com site/API
> I've been building for you, I need you to add one DNS record in your
> GoDaddy account. It's a single row, takes about 30 seconds, and won't
> affect your email or anything else on the domain.
>
> **What you need to do**
>
> 1. Sign in to GoDaddy.
> 2. Go to *My Products* → *Domains* → click **globalgallivant.com**.
> 3. Open the *DNS* (or *Manage DNS*) section. You'll see a table of DNS
>    records.
> 4. Click *Add* (or *Add New Record*) and enter exactly this:
>    - **Type:** `CNAME`
>    - **Name:** `www`
>    - **Value / Points to:** `110deb4d9bdb4bcb.vercel-dns-017.com.`
>      *(including the trailing dot if GoDaddy accepts it; if GoDaddy
>      rejects the trailing dot, drop it — both work)*
>    - **TTL:** leave the default (1 Hour is fine)
> 5. Click *Save*.
>
> That's it. Within a few minutes the new site will be live at
> **www.globalgallivant.com**, and I'll take it from there.
>
> **Will this break my email?** No. This adds a new record on `www` only —
> your MX records, apex, and everything else on the domain stay exactly as
> they are.
>
> **Can I undo it later?** Yes — in the same DNS screen you can delete the
> `www` CNAME record at any time and the `www.globalgallivant.com` site
> stops resolving. Let me know if you ever want to do that.

## 5. Verification (after propagation)

Run these from any shell once `dig +short www.globalgallivant.com` returns
a `.vercel-dns-017.com.` target plus Vercel anycast IPs. The
`HTTP_AUTH_TOKEN` used below is the same one set via
`vercel env add HTTP_AUTH_TOKEN` during initial deployment.

```bash
# 1. CNAME resolves to Vercel.
dig www.globalgallivant.com CNAME +short
# expected: 110deb4d9bdb4bcb.vercel-dns-017.com.

# 2. Full resolution chain ends at Vercel anycast IPs.
dig +short www.globalgallivant.com

# 3. Zoe's email records are untouched (sanity check — MX should be
#    exactly what it was before).
dig +short MX globalgallivant.com

# 4. Health probe on the custom domain.
curl -sI https://www.globalgallivant.com/healthz

# 5. OpenAPI server URL reflects the custom domain. This is the key check —
#    it confirms the dynamic Host-header path in src/transports/http.ts is
#    working end-to-end.
curl -s https://www.globalgallivant.com/openapi.json \
  | jq '.servers[0].url'
# expected: "https://www.globalgallivant.com"

# 6. Privacy page renders (tests the full Express catch-all path).
curl -s https://www.globalgallivant.com/privacy | head -5

# 7. Authenticated tool call via the REST mirror.
curl -sH "Authorization: Bearer $HTTP_AUTH_TOKEN" \
  -H 'content-type: application/json' \
  https://www.globalgallivant.com/actions/list_destinations \
  -d '{"limit":3}'
```

In the Vercel dashboard, *global-gallivant → Settings → Domains* should
show `www.globalgallivant.com` with a green "Valid Configuration" status
and a Let's Encrypt certificate issued within the last minute.

**If step 5 fails** (i.e. `servers[0].url` still shows a `*.vercel.app`
host): the request didn't arrive with the custom `Host` header. Confirm
Vercel's domain attachment is complete and the CNAME has fully propagated,
then retry — no code change should be required.

## 6. Rollback

To detach the custom domain, do **both** of the following:

1. **In Vercel**, *global-gallivant → Settings → Domains*, click the `⋯`
   menu on `www.globalgallivant.com` and choose *Remove*. The
   `*.vercel.app` hostnames keep working — no deploy needed.
2. **Ask Zoe to delete the `www` CNAME record** at GoDaddy (*Manage DNS*
   → find the `www` CNAME row → *Delete*). Not strictly required — leaving
   it in place is harmless — but cleaner.

## 7. Advanced alternative: nameserver delegation

Documented here for completeness. **Do not use this path unless you have a
specific reason to want Wilfred to own DNS for the whole zone.** It's
strictly more risky than section 3 because it touches every record on the
domain, not just `www`.

If you ever do need it:

1. In Vercel (*Settings → Domains → Add*), add `globalgallivant.com` (the
   apex) and choose **"Change Nameservers (Recommended)"** instead of "Add
   DNS Records". Vercel will show these two nameservers:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
2. **Before** asking Zoe to change nameservers, inventory every existing
   DNS record on the zone and recreate it in Vercel DNS by hand:

   ```bash
   dig +noall +answer globalgallivant.com       A AAAA
   dig +noall +answer globalgallivant.com       MX
   dig +noall +answer globalgallivant.com       TXT
   dig +noall +answer _dmarc.globalgallivant.com TXT
   dig +noall +answer google._domainkey.globalgallivant.com TXT
   dig +noall +answer www.globalgallivant.com   A AAAA CNAME
   ```

   Any MX/SPF/DKIM/DMARC records not recreated in Vercel DNS *before*
   nameserver propagation will silently break email. This is the reason
   section 3's CNAME-only path is preferred.
3. Ask Zoe to change GoDaddy's nameservers to `ns1.vercel-dns.com` /
   `ns2.vercel-dns.com` in *My Products → Domains → globalgallivant.com
   → DNS → Nameservers → Change → "I'll use my own nameservers"*.

Rolling this back means asking Zoe to switch GoDaddy nameservers back to
"GoDaddy default nameservers" in the same screen, and pre-populating any
DNS changes back at GoDaddy first.

## 8. Why nothing changes in `vercel.json` or source code

- `vercel.json` — Vercel intentionally does not let you configure domain
  attachment from the repo config. Domain ownership lives in the project
  settings. Leaving `vercel.json` alone is the right answer.
- `src/transports/http.ts` — the `/openapi.json` handler builds the base
  URL from `req.get('host')` + `x-forwarded-proto` on every request
  (around line 214), so once Vercel routes the custom domain to the
  function the OpenAPI spec will automatically advertise
  `https://www.globalgallivant.com` without any code change. Default
  `cors()` (around line 151) is already permissive, so no Origin allowlist
  needs updating.
- `src/openapi/generate.ts` — `generateOpenApiDocument(baseUrl, ...)` takes
  the base URL as a parameter and reflects it back in `servers[0].url`,
  so it's already domain-agnostic. Nothing to change here.
- `api/[...path].ts` — the catch-all handler only strips the `/api` prefix
  Vercel adds; it's host-agnostic. Nothing to change here either.

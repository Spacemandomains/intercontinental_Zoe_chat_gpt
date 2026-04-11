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

The original `*.vercel.app` hostnames continue to work as fallbacks (and are
still the canonical URL for preview deployments on every PR).

## 2. Ownership split

- **Domain** `globalgallivant.com` is registered to **International Zoe** at
  **GoDaddy**. DNS is currently served by GoDaddy's default nameservers.
- **Vercel project** `global-gallivant` lives in the `wilfred-lee-jrs-projects`
  team, which Wilfred owns.

Because these are two different accounts, the approach is to **delegate DNS
for `globalgallivant.com` to Vercel**: Zoe changes the GoDaddy nameservers
once, and from then on Wilfred manages every DNS record (apex, www, and
anything else) from the Vercel dashboard under his own team, without needing
further access to Zoe's GoDaddy account.

## 3. Setup — for the project owner (Wilfred)

### 3a. DNS pre-flight (run BEFORE touching anything)

Before Vercel takes over DNS, inventory every non-default record on the
zone. Anything not replicated into Vercel DNS in step 3c will silently
disappear the moment the nameserver swap propagates. **Email records (MX,
SPF/TXT, DKIM, DMARC) are the most common thing to lose here** — if Zoe
receives mail at `@globalgallivant.com` via Google Workspace, Zoho,
Fastmail, or similar, those records MUST be copied over first.

```bash
dig +noall +answer globalgallivant.com       A AAAA
dig +noall +answer globalgallivant.com       MX
dig +noall +answer globalgallivant.com       TXT
dig +noall +answer _dmarc.globalgallivant.com TXT
dig +noall +answer google._domainkey.globalgallivant.com TXT   # if on Google Workspace
dig +noall +answer www.globalgallivant.com   A AAAA CNAME
```

Also ask Zoe directly whether she uses email on that domain, whether she
has any other subdomains set up (blog, store, redirects), and what platform
those point at. Write everything down — this is the authoritative list
to recreate in step 3c.

### 3b. Add the domains to the Vercel project

Dashboard path:

1. Open *Vercel → `wilfred-lee-jrs-projects` → `global-gallivant` → Settings →
   Domains*.
2. Click *Add*, enter `globalgallivant.com` (the apex), and submit. Adding
   the apex first is important — it's what causes Vercel to assign
   nameservers for the whole zone.
3. When Vercel prompts for a verification method, choose **"Change
   Nameservers (Recommended)"**. The screen will show two nameservers in
   the form `nsX.vercel-dns.com`. **Copy these two values** — you'll hand
   them to Zoe in step 3d. The pair is team-specific, so don't assume
   `ns1`/`ns2`.
4. Click *Add* again and add `www.globalgallivant.com`. Mark it as the
   primary domain and configure the apex (`globalgallivant.com`) to
   *Redirect to www.globalgallivant.com* with a 308 permanent redirect.

CLI equivalents (optional — requires `vercel login` first):

```bash
vercel domains add globalgallivant.com --scope wilfred-lee-jrs-projects
vercel domains add www.globalgallivant.com global-gallivant \
  --scope wilfred-lee-jrs-projects
```

Vercel will show "Invalid Configuration" next to both entries until DNS
propagates in step 3e. That's expected and harmless.

### 3c. Pre-populate Vercel DNS (BEFORE Zoe flips nameservers)

In the Vercel dashboard, open the DNS tab for `globalgallivant.com` and
recreate every non-default record captured in step 3a. Vercel will create
the A/CNAME entries for the apex and `www` subdomain automatically once the
project domain is attached — everything else (MX, SPF TXT, DKIM, DMARC,
other subdomains, etc.) has to be added by hand.

Double-check that the MX/SPF/DKIM/DMARC records match Zoe's current email
provider exactly. This is the step that saves Zoe's inbox.

### 3d. Handoff to Zoe

Paste the message in section 4 below into an email or DM to Zoe, **after**
filling in the two `nsX.vercel-dns.com` values you copied in step 3b (the
placeholders in the template are `NS1_PLACEHOLDER` and `NS2_PLACEHOLDER`).

### 3e. Wait for propagation and cert issuance

After Zoe saves the nameserver change at GoDaddy:

- Nameserver delegation usually propagates in **15 minutes to 4 hours**,
  worst case 48 hours. Track with `dig NS globalgallivant.com` — once the
  answer section shows `nsX.vercel-dns.com` entries, delegation is live.
- Vercel auto-provisions a Let's Encrypt certificate within ~1 minute of
  DNS resolving. The *Domains* tab will flip from "Invalid Configuration"
  to "Valid" without any further action.

Then run the verification checklist in section 5.

## 4. Handoff message — for the domain owner (International Zoe)

Paste this into an email or DM to Zoe after filling in the two
`nsX.vercel-dns.com` values. It's intentionally short and non-technical.

> Hey Zoe — to finish hooking up the new globalgallivant.com site/API I've
> been building for you, I need you to change one thing in your GoDaddy
> account. It'll take about 60 seconds. No other settings need to change
> and your email will keep working exactly the same.
>
> **What you need to do**
>
> 1. Sign in to GoDaddy.
> 2. Go to *My Products* → *Domains* → click **globalgallivant.com**.
> 3. Find the *DNS* (or *Manage DNS*) section, then scroll to *Nameservers*.
> 4. Click *Change* → choose **"I'll use my own nameservers"** (sometimes
>    labeled "Custom").
> 5. Delete GoDaddy's default nameservers and enter these two instead:
>    - `NS1_PLACEHOLDER`
>    - `NS2_PLACEHOLDER`
> 6. Click *Save*. GoDaddy will show a warning about leaving GoDaddy DNS —
>    that's expected, go ahead and confirm.
>
> That's it. Within a few hours the new site will be live at
> **www.globalgallivant.com**, and I'll take it from there.
>
> **Will this break my email?** No. I've already copied your email records
> over to the new DNS so everything keeps routing to the same place.
>
> **Can I undo it later?** Yes — in the same screen you can switch back to
> "GoDaddy default nameservers" at any time and DNS comes back to you. Let
> me know if you ever want to do that.

## 5. Verification (after propagation)

Run these from any shell once `dig NS globalgallivant.com` shows the Vercel
nameservers. The `HTTP_AUTH_TOKEN` used below is the same one set via
`vercel env add HTTP_AUTH_TOKEN` during initial deployment.

```bash
# 1. Nameserver delegation took effect.
dig NS globalgallivant.com

# 2. www resolves to Vercel.
dig +short www.globalgallivant.com

# 3. Email records still present (sanity check — compare to the pre-flight
#    snapshot from section 3a).
dig +short MX globalgallivant.com

# 4. Health probe on the custom domain.
curl -sI https://www.globalgallivant.com/healthz

# 5. OpenAPI server URL reflects the custom domain (this is the key check —
#    it confirms the dynamic Host-header path in src/transports/http.ts is
#    working end-to-end).
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

# 8. Apex redirect works.
curl -sI https://globalgallivant.com
# expected: HTTP/2 308, location: https://www.globalgallivant.com/
```

In the Vercel dashboard, *global-gallivant → Settings → Domains* should show
both `globalgallivant.com` and `www.globalgallivant.com` with a green
"Valid Configuration" status and a Let's Encrypt certificate issued within
the last minute.

**If step 5 fails** (i.e. `servers[0].url` still shows a `*.vercel.app`
host): the request didn't arrive with the custom `Host` header. Confirm the
Vercel domain attachment is complete and retry — no code change should be
required.

## 6. Rollback

Two levels, depending on what you're rolling back:

**Fast (keep DNS on Vercel, just detach the domain from this project):**
In the Vercel dashboard, *Settings → Domains*, click the `⋯` menu on
`www.globalgallivant.com` and/or `globalgallivant.com` and choose *Remove*.
The `*.vercel.app` hostnames keep working — no deploy needed, no DNS
changes. Vercel still owns DNS for the zone, so email and any other
records you pre-populated keep working.

**Full (return DNS to GoDaddy):** before anything else, write down every
record currently in Vercel DNS so you can recreate them at GoDaddy. Then
ask Zoe to repeat section 4 but choose "GoDaddy default nameservers"
instead of "I'll use my own nameservers". Propagation and record recovery
take the same 15 minutes to 48 hours as the forward cutover.

## 7. Why nothing changes in `vercel.json` or source code

- `vercel.json` — Vercel intentionally does not let you configure domain
  attachment from the repo config. Domain ownership lives in the project
  settings (and the DNS zone lives in Vercel DNS). Leaving `vercel.json`
  alone is the right answer.
- `src/transports/http.ts` — the `/openapi.json` handler builds the base URL
  from `req.get('host')` + `x-forwarded-proto` on every request (around line
  214), so once Vercel routes the custom domain to the function the OpenAPI
  spec will automatically advertise `https://www.globalgallivant.com`
  without any code change. Default `cors()` (around line 151) is already
  permissive, so no Origin allowlist needs updating.
- `src/openapi/generate.ts` — `generateOpenApiDocument(baseUrl, ...)` takes
  the base URL as a parameter and reflects it back in `servers[0].url`,
  meaning it's already domain-agnostic. Nothing to change here.
- `api/[...path].ts` — the catch-all handler only strips the `/api` prefix
  Vercel adds; it's host-agnostic. Nothing to change here either.

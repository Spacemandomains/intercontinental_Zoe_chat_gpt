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

The bare apex `https://globalgallivant.com` also resolves: it returns a
308 permanent redirect to `https://www.globalgallivant.com/`, so any
visitor who types `globalgallivant.com` into a browser or hits it with
`curl -L` ends up on the canonical `www` host.

The original `*.vercel.app` hostnames continue to work as fallbacks (and
remain the canonical URL for preview deployments on every PR).

## 2. Ownership split

- **Domain** `globalgallivant.com` is registered to **International Zoe** at
  **GoDaddy**. DNS is served by GoDaddy.
- **Vercel project** `global-gallivant` lives in the `wilfred-lee-jrs-projects`
  Vercel team, which Wilfred owns.

Because these are two different accounts, the chosen approach is to make
the smallest possible DNS change at GoDaddy: **two DNS records**, a CNAME
on `www` and an A record on the apex `@`. Everything else on the zone —
email (MX/SPF/DKIM/DMARC), any other subdomains Zoe already has — stays
exactly as it is today at GoDaddy, so there's zero risk to Zoe's existing
email. (MX records take precedence over A records for mail delivery, so
adding an apex A record for web traffic does not affect incoming email.)

> **Alternative path:** Vercel also offers full nameserver delegation for
> the whole zone. That gives Wilfred self-serve DNS management from the
> Vercel dashboard, but it's a heavier one-time change for Zoe and carries
> real risk to her email unless every existing record is captured and
> re-created in Vercel DNS first. For this project (an API server that
> doesn't need flexible DNS) the single-CNAME path is strictly simpler and
> safer, and it is the primary path this guide describes. The nameserver
> alternative is documented briefly in section 7.

## 3. Setup — for the project owner (Wilfred)

### 3a. Add both domains in Vercel

Dashboard path:

1. Open *Vercel → `wilfred-lee-jrs-projects` → `global-gallivant` → Settings
   → Domains*.
2. Click *Add*, enter `www.globalgallivant.com`, submit, and when Vercel
   prompts for a verification method choose **"Add DNS Records"** (not
   "Change Nameservers"). Vercel displays the CNAME record Zoe will need
   to create at GoDaddy:

   | Type  | Name | Value                                     |
   |-------|------|-------------------------------------------|
   | CNAME | www  | `110deb4d9bdb4bcb.vercel-dns-017.com.`    |

3. Click *Add* again and enter `globalgallivant.com` (the bare apex).
   Vercel will detect that `www.globalgallivant.com` already exists and
   offer to set up the apex as a **308 redirect to
   `www.globalgallivant.com`** — accept that. Then, when prompted for DNS,
   choose **"Add DNS Records"** again. Vercel displays the A record for
   the apex:

   | Type | Name | Value           |
   |------|------|-----------------|
   | A    | @    | `76.76.21.21`   |

   `76.76.21.21` is Vercel's anycast apex IP and has been stable for
   years; however, Vercel occasionally assigns a different IP on a
   per-project basis, so **use whatever value Vercel actually displays on
   the screen** and substitute it into Zoe's handoff message below if it
   differs.

Both entries will show "Invalid Configuration" until Zoe's DNS records are
live at GoDaddy and have propagated. That's expected.

CLI equivalent (optional — requires `vercel login` first):

```bash
vercel domains add www.globalgallivant.com global-gallivant \
  --scope wilfred-lee-jrs-projects
vercel domains add globalgallivant.com global-gallivant \
  --scope wilfred-lee-jrs-projects
```

### 3b. Hand off to Zoe

Forward the message in section 4 below to Zoe. She adds two DNS records
(one CNAME, one A) at GoDaddy and that's it — no nameserver changes, no
email impact, no coordination after that.

**If Zoe has already added the CNAME** from an earlier round (before the
apex redirect was requested), forward only the "Addendum" message in
section 4b instead — it covers just the new A record.

### 3c. Wait and verify

After Zoe saves the records at GoDaddy:

- Propagation is typically **5–30 minutes** for new DNS records, worst
  case ~4 hours. Track with:
  - `dig +short www.globalgallivant.com` — as soon as this returns a
    target ending in `.vercel-dns-017.com.` followed by Vercel anycast
    IPs, the subdomain is live.
  - `dig +short globalgallivant.com` — as soon as this returns
    `76.76.21.21` (or whatever A record Vercel assigned), the apex is
    live.
- Vercel auto-provisions a Let's Encrypt certificate for each domain
  within ~1 minute of DNS resolving. The *Domains* tab flips from
  "Invalid Configuration" to "Valid" without any further action.

Then run the verification checklist in section 5.

## 4. Handoff message — for the domain owner (International Zoe)

Paste this into an email or DM to Zoe. It's intentionally short and
non-technical.

> Hey Zoe — to finish hooking up the new globalgallivant.com site/API I've
> been building for you, I need you to add two DNS records in your GoDaddy
> account. It's two rows, takes about 60 seconds, and won't affect your
> email or anything else on the domain.
>
> **What you need to do**
>
> 1. Sign in to GoDaddy.
> 2. Go to *My Products* → *Domains* → click **globalgallivant.com**.
> 3. Open the *DNS* (or *Manage DNS*) section. You'll see a table of DNS
>    records.
> 4. Click *Add* (or *Add New Record*) and create the **first** record:
>    - **Type:** `CNAME`
>    - **Name:** `www`
>    - **Value / Points to:** `110deb4d9bdb4bcb.vercel-dns-017.com.`
>      *(including the trailing dot if GoDaddy accepts it; if GoDaddy
>      rejects the trailing dot, drop it — both work)*
>    - **TTL:** leave the default (1 Hour is fine)
>
>    Click *Save*.
> 5. Click *Add* again and create the **second** record:
>    - **Type:** `A`
>    - **Name:** `@` *(this means "the bare domain itself". GoDaddy may
>      show it as blank, or as `globalgallivant.com` — both mean the same
>      thing. Do NOT type `globalgallivant.com` into the Name field; just
>      use `@` or leave it blank.)*
>    - **Value / Points to:** `76.76.21.21`
>    - **TTL:** leave the default (1 Hour is fine)
>
>    Click *Save*.
>
>    **Important:** if GoDaddy already has an A record on `@` pointing
>    somewhere else (for example, to a parked-page IP or an old Squarespace
>    address), **delete the old one first**, then add the new one above.
>    GoDaddy will not let two A records on the same name coexist.
>
> That's it. Within a few minutes both `www.globalgallivant.com` and
> `globalgallivant.com` will be live, with `globalgallivant.com`
> automatically redirecting to `www.globalgallivant.com`.
>
> **Will this break my email?** No. MX records (which control email
> delivery) take priority over A records for mail, so changing the A
> record on the apex only affects where web browsers go — email keeps
> routing to the same place it does today.
>
> **Can I undo it later?** Yes — in the same DNS screen you can delete
> either record at any time and the corresponding site stops resolving.
> Let me know if you ever want to do that.

## 4b. Addendum — if Zoe already added the `www` CNAME

If you forwarded the first version of section 4 (CNAME only, no apex) to
Zoe already and she's done it, paste this shorter follow-up instead of the
full message above. It covers just the new apex A record.

> Hey Zoe — one more DNS record to add. When we set up the `www` CNAME
> earlier I hadn't planned for the bare `globalgallivant.com` (without the
> `www.` in front), but I'd like that to also point at the new site and
> redirect people over to `www.globalgallivant.com`. Takes about 30
> seconds:
>
> 1. Back in GoDaddy → *My Products* → *Domains* → **globalgallivant.com**
>    → *DNS* / *Manage DNS*.
> 2. Before adding anything new, check whether an A record on `@` (the
>    bare domain) already exists. If it does, **delete it first** —
>    GoDaddy won't let two A records on the same name coexist.
> 3. Click *Add* / *Add New Record* and enter:
>    - **Type:** `A`
>    - **Name:** `@` *(just `@`, or leave blank — both mean "the bare
>      domain". Do not type `globalgallivant.com` into this field.)*
>    - **Value / Points to:** `76.76.21.21`
>    - **TTL:** leave the default (1 Hour is fine)
> 4. Click *Save*.
>
> That's it. Within a few minutes `globalgallivant.com` (without the
> `www.`) will automatically redirect to `www.globalgallivant.com`.
>
> **Will this break my email?** No. MX records, which control email
> delivery, take priority over A records for mail — so the A record only
> affects where web browsers go, not where email lands.

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

# 8. Apex redirect works.
curl -sI https://globalgallivant.com
# expected: HTTP/2 308 (or 301)
#           location: https://www.globalgallivant.com/

# 9. Follow the apex redirect end-to-end.
curl -sIL https://globalgallivant.com/healthz | grep -E '^HTTP|^location'
# expected: one 308/301 from globalgallivant.com, then a 200 from
#           www.globalgallivant.com
```

In the Vercel dashboard, *global-gallivant → Settings → Domains* should
show **both** `www.globalgallivant.com` and `globalgallivant.com` with a
green "Valid Configuration" status and a Let's Encrypt certificate issued
within the last minute. The apex entry should also show a "Redirect to
www.globalgallivant.com" label.

**If step 5 fails** (i.e. `servers[0].url` still shows a `*.vercel.app`
host): the request didn't arrive with the custom `Host` header. Confirm
Vercel's domain attachment is complete and the CNAME has fully propagated,
then retry — no code change should be required.

**If step 8 fails with a non-Vercel response** (e.g. a GoDaddy parked page
or a different site): GoDaddy still has an old A record on `@` that
wasn't deleted before the new one was added. Ask Zoe to go back to the
DNS screen and remove any A record on `@` that isn't `76.76.21.21`.

## 6. Rollback

To detach the custom domain entirely:

1. **In Vercel**, *global-gallivant → Settings → Domains*, click the `⋯`
   menu on `www.globalgallivant.com` and choose *Remove*, then do the
   same for `globalgallivant.com`. The `*.vercel.app` hostnames keep
   working — no deploy needed.
2. **Ask Zoe to delete the DNS records** at GoDaddy (*Manage DNS*):
   - The `www` CNAME → `110deb4d9bdb4bcb.vercel-dns-017.com.`
   - The `@` A record → `76.76.21.21`

   Not strictly required — leaving them in place is harmless once the
   Vercel project no longer claims the domains, because the A/CNAME
   targets simply return a Vercel "no such project" page — but cleaner.
   If Zoe wants `globalgallivant.com` to serve a different site after
   rollback, she'll also need to recreate whatever A record she had on
   `@` before the switch (ask her what it should point at).

To roll back only the apex redirect (keep `www.globalgallivant.com`
working):

1. In Vercel, remove only the `globalgallivant.com` entry, leave
   `www.globalgallivant.com` in place.
2. Ask Zoe to delete only the `@` A record at GoDaddy.

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

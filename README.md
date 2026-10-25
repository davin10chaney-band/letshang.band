# Let's Hang · High School (letshang.band)

A private band app for high school students and their parents. Runs on Cloudflare Workers.

- **Students** sign themselves up with the **band code** (BAND-XXXX). Their chats are private from parents.
- **Parents** sign up with the **parent code** (FAM-XXXX) and get their own threads.
- The **first account** created becomes the admin and sees both codes under 🛡️ Admin.
- Guardrails: bad language, slurs, threats and sexual content are blocked; harsh messages get a "kindness check";
  self-harm language quietly alerts adult admins and shows the 988 line; every photo is checked by AI before it's posted.
- Hidden from search engines (robots.txt, noindex headers).

## Cloudflare pieces
| Binding | What | Name |
|---|---|---|
| `DB` | D1 database | `lets-hang-hs` |
| `FILES` | R2 bucket (sheet music + photos) | `letshang-band-files` |
| `AI` | Workers AI (guardrails + photo checks) | — |

Deploy command (Workers Builds): `npx wrangler deploy`. The database sets itself up on first request.

Optional texting: add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` as secrets.

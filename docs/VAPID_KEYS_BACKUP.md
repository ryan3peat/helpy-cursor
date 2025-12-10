# VAPID Keys Backup

> **IMPORTANT:** Keep this file secure. These keys are used for push notifications.
> Generated: December 10, 2024

## Current Active Keys (Generated Dec 10, 2024)

These are the keys currently in use:

### Public Key
Used in: `.env.local`, Vercel, Supabase secrets
```
BCLyLeIeXXBXZS7D-XGvU7lbePYUobNKdoXl1fkVyygp9FEUj2sxb8VwgpukeIoTH3yxOXMIDbl75Z3oQtGTUOg
```

### Private Key
Used in: Supabase secrets only (never expose in frontend!)
```
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg2Ci-iksuGARnyAQUGzjOOCwis5Xjmv3sYNkLu1jUf36hRANCAAQi8i3iHl1wV2Uuw_lxr1O5W3j2FKGzSnaF5dX5FcsoKfRRFI9rMW_FcIKbpHiKEx98sTlzCA25e-Wd6ELRk1Do
```

### Subject
```
mailto:julianoliko@gmail.com
```

---

## Ryan's Original Keys (Dec 9, 2024)

**We do NOT have these values** - Supabase hides secrets after saving.

If Ryan saved them somewhere, add them here:

### Public Key (Ryan's)
```
[Ask Ryan if he has this saved]
```

### Private Key (Ryan's)
```
[Ask Ryan if he has this saved]
```

---

## Where Keys Are Configured

| Location | Key Type | Variable Name |
|----------|----------|---------------|
| `.env.local` | Public | `VITE_VAPID_PUBLIC_KEY` |
| Vercel | Public | `VITE_VAPID_PUBLIC_KEY` |
| Supabase Secrets | Public | `VAPID_PUBLIC_KEY` |
| Supabase Secrets | Private | `VAPID_PRIVATE_KEY` |
| Supabase Secrets | Subject | `VAPID_SUBJECT` |

---

## How to Generate New Keys

If you ever need new keys:

```bash
npx web-push generate-vapid-keys
```

Or use browser console (generates PKCS8 format for Deno):
```javascript
(async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('raw', kp.publicKey);
  const priv = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  console.log('Public:', b64(pub));
  console.log('Private:', b64(priv));
})();
```

---

## Important Notes

1. **If you change keys**, all existing push subscriptions become invalid
2. Users will need to **re-enable notifications** in their app
3. Private key must be in **PKCS8 format** for the Edge Function to work
4. Keys generated with `npx web-push` work, but browser method is more reliable for Deno


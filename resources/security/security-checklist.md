## Basic Security Checklist

  - [ ] RLS (Row-Level Security) enabled on both tables: `games` and `scores`
  - [ ] Minimum password length — at least 8 characters
  - [ ] Leaked password protection — (warning #4)
  - [ ] Max signup rate — limit signups per IP (anti-bot measure)
  - [ ] Security headers in Next.js
  
  Ex:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// In the Next.js config:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## On the Supabase side:

| name                            | title                               | level | facing   | categories   | description                                       | detail                                                                                                                                   | remediation                                                                                              | metadata                        | cache_key                       |
| ------------------------------- | ----------------------------------- | ----- | -------- | ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------- |
| auth_leaked_password_protection | Leaked Password Protection Disabled | WARN  | EXTERNAL | ["SECURITY"] | Leaked password protection is currently disabled. | Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security. | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection | {"entity":"Auth","type":"auth"} | auth_leaked_password_protection |
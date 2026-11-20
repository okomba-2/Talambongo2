# TalaMbongo Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Role Isolation & No Self-Escalation**: Every new user account created via client SDK MUST have `role == 'USER'` unless the caller already satisfies `isAdmin()`. Regular users can NEVER update `role` or write to `/admins/{uid}`.
2. **Strict PII Ownership**: `/users/{userId}` documents contain PII (`email`, `name`, `country`) and may ONLY be read (`get`) by the owning user (`request.auth.uid == userId`) or a verified `ADMIN`. Blanket `list` on `/users` is strictly restricted to `isAdmin()`.
3. **Personal Expense Confidentiality**: `/users/{userId}/expenses/{expenseId}` is strictly owner-only (`request.auth.uid == userId`). Neither other users nor administrators can inspect individual personal expense entries.
4. **Admin Telemetry Isolation**: `/admin_stats/{statId}` and `/admins/{adminUid}` list queries are strictly restricted to verified `ADMIN` callers (`isAdmin()`).
5. **Temporal & Schema Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on update. `updatedAt` must equal `request.time` on both creation and update. All strings enforce bounded `.size()` limits, and all document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars).
6. **Email Verification Gate**: Standard authenticated writes and admin privileges require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Self-Privilege Escalation on Create**: User `u1` creates `/users/u1` with `{ role: 'ADMIN', ... }`.
2. **Self-Privilege Escalation on Update**: User `u1` updates `/users/u1` with `{ role: 'ADMIN', updatedAt: serverTimestamp() }`.
3. **Shadow Ghost Field Injection**: User `u1` creates `/users/u1` with valid fields plus `{ isAdminOverride: true }`.
4. **Admin Registry Poisoning**: Non-admin user `u1` writes `/admins/u1`.
5. **Cross-User PII Snooping**: User `u1` attempts `get` on `/users/u2` or `list` on `/users`.
6. **Cross-User Expense Access**: User `u1` or even an `ADMIN` attempts to read `/users/u2/expenses/exp1`.
7. **Unverified Admin Email Spoofing**: Caller presents unverified email token (`email_verified: false`) matching admin email and attempts to read `/admin_stats/global_summary`.
8. **Admin Stats Tampering**: Regular user `u1` attempts to read or write `/admin_stats/global_summary`.
9. **Subscription Identity Spoofing**: User `u1` creates `/subscriptions/sub1` with `{ userId: 'u2', paymentStatus: 'confirmed' }`.
10. **Immutable CreatedAt Backdating**: User `u1` creates `/users/u1` with a past client timestamp for `createdAt` or alters `createdAt` on update.
11. **ID Poisoning / Oversized String Attack**: User `u1` attempts to write a 10KB string into `country` or `title` or an invalid document ID containing `/` or `$`.
12. **Blanket List Query Scraping**: Regular user `u1` runs `getDocs(collection(db, 'subscriptions'))` without filtering to `where('userId', '==', u1)`.
13. **Partner PII Isolation & Link Enumeration**: Unauthenticated or regular user runs `list` on `/partners` or `/partner_links` or reads `/partners/{partnerId}`. Only single-doc `get` on zero-PII `/partner_links/{code}` is permitted.
14. **Referral Tampering & Expired/Inactive Attribution**: Visitor or user creates a click, referral session, or `/users/{uid}` document referencing a nonexistent, `suspended`, `disabled`, or expired (`request.time > endDate`) partner code, OR updates their `/users/{uid}` doc after creation to attach or alter `referredByPartnerId` / `referredByCode`.
15. **Commission Fraud & Duplicate Creation**: User creates `/partner_commissions/{wrongId}` (`!= uid`), creates a commission without an accompanying `confirmed` subscription, inflates `amountXof` above `/partner_links/{code}.commissionPerUserXof`, sets `status: 'paid'` on create, or creates a second commission on renewal.
16. **Trial Extension / Repeat Trial Fraud**: User creates `/users/{uid}` with `trialEndsAt > request.time + 7d` or `subscriptionStatus: 'active'`, or attempts to update `trialStartedAt`, `trialEndsAt`, or `hasUsedFreeTrial` after creation to obtain a second free trial.
17. **Self-Activated / Unconfirmed Subscription Bypass**: User updates `/users/{uid}` to `subscriptionStatus: 'active'` or `'renewed'` without an accompanying confirmed `/subscriptions/{subId}` (`paymentStatus == 'confirmed'`) matching exact start/end dates and verified minimum amount, OR creates a `/subscriptions/{subId}` with `paymentStatus: 'pending' | 'failed'` and `status: 'active'`.
18. **Expired User Expense Write Bypass**: User with expired 7-day trial and no active confirmed subscription attempts to directly `create` or `delete` documents under `/users/{uid}/expenses/{expenseId}` (must return `PERMISSION_DENIED`, while preserving read access to existing data).

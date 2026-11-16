# FitForge Firestore Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants & Master Source of Truth
1. **Master Gate & Tenant Isolation**: Every document in `/users/{userId}` and its subcollections (`/runs/{runId}`, `/workouts/{workoutId}`, `/nutrition/{mealId}`) is strictly owned by `userId`. Access requires `request.auth != null`, `request.auth.token.email_verified == true`, and `request.auth.uid == userId`.
2. **Relational Parent Existence (Subcollection Master Gate)**: A subcollection document (`runs`, `workouts`, `nutrition`) cannot be created, read, updated, or deleted unless the parent `/users/$(userId)` document exists (`exists(/databases/$(database)/documents/users/$(userId))`) and `get(/databases/$(database)/documents/users/$(userId)).data.ownerId == request.auth.uid`.
3. **Strict Schema & Key Allowlisting**: Every `create` and `update` must pass `isValidUserAccountData`, `isValidRunSessionDoc`, `isValidWorkoutLogDoc`, or `isValidNutritionLogDoc`, enforcing `hasAll` and `hasOnly` with strict string `.size()` and number boundary checks.
4. **Temporal & Identity Immutability**: `ownerId` and `createdAt` are immutable on all updates (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`). `createdAt` must equal `request.time` on `create`, and `updatedAt` must equal `request.time` on both `create` and `update`.
5. **Query Enforcer on `list`**: Every `allow list` rule explicitly enforces `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without `get()`/`exists()` inside `list` blocks to prevent O(n) read cost explosions.

## 2. The "Dirty Dozen" Payloads (Designed to Break Identity, Integrity & State)
1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting `create` on `/users/uid1`. -> `PERMISSION_DENIED`
2. **Cross-Tenant Read (PII Leak)**: `uid2` attempting `get` or `list` on `/users/uid1`. -> `PERMISSION_DENIED`
3. **OwnerId Spoofing on Create**: `uid1` creating `/users/uid1` with `ownerId: "uid2"`. -> `PERMISSION_DENIED`
4. **Shadow/Ghost Field Injection**: `uid1` updating `/users/uid1` with an extra field `isAdmin: true`. -> `PERMISSION_DENIED`
5. **Client Timestamp Forgery**: `uid1` creating `/users/uid1/runs/run1` with a past/future `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`
6. **Immutable Field Mutation**: `uid1` updating `createdAt` or `ownerId` on `/users/uid1`. -> `PERMISSION_DENIED`
7. **Orphan Subcollection Write**: `uid1` creating `/users/uid1/runs/run1` before `/users/uid1` parent document exists. -> `PERMISSION_DENIED`
8. **ID Poisoning Attack**: `uid1` creating `/users/uid1/runs/invalid..id$$` with non-alphanumeric path ID or >128 chars. -> `PERMISSION_DENIED`
9. **Oversized String DoS ("Denial of Wallet")**: `uid1` creating `/users/uid1/nutrition/m1` with `saran_AI` of length 5000 (`> 600`). -> `PERMISSION_DENIED`
10. **Negative Metric Injection**: `uid1` updating `waterMl: -500` or `distanceKm: -10`. -> `PERMISSION_DENIED`
11. **Invalid Enum Value**: `uid1` updating `planMode: "hacker_mode"` (outside `['gym', 'home']`). -> `PERMISSION_DENIED`
12. **Unauthorized Subcollection List**: `uid2` listing `/users/uid1/workouts`. -> `PERMISSION_DENIED`

## 3. Red Team Conflict Report
- **Identity Spoofing**: Blocked by `data.ownerId == request.auth.uid && userId == request.auth.uid`.
- **Resource/Value Poisoning**: Blocked by `isValidId(id)` (`<= 128` chars, `^[a-zA-Z0-9_\-]+$`) and mandatory `.size()` / numeric range boundaries inside every `isValid*` helper wrapped around all `create` and `update` blocks.
- **Update-Gap**: Closed by requiring `isValid[Entity](incoming())` at the top of every `allow update` rule combined with `incoming().diff(existing()).affectedKeys().hasOnly(...)`.

# Back Navigation & History Architecture

Guidelines and standards for back navigation, browser history management, and screen hierarchies.

---

## 1. Core Principles

- **Prefer Deterministic Links Over History Pops**: Hierarchical child views (e.g., active sessions, tournament brackets, rosters) must navigate directly to their parent group via explicit `<BackButton href="...">` or `<Link>` rather than `router.back()`.
- **Replace Intermediate Creation Routes**: Form submittals that generate resources (e.g., `/sessions/new`, `/tournaments/new`) must use `router.replace(...)` to prevent the browser back button from re-entering submitted setup forms.
- **Guard External Referrers**: History-based back triggers must never eject a user out of the app when arriving via external links (SMS, QR, email).

---

## 2. Component API: `BackButton`

Reference: [`src/components/ui/back-button.tsx`](../src/components/ui/back-button.tsx)

```typescript
export interface BackButtonProps {
  href?: string;         // Deterministic navigation target (renders Next.js <Link>)
  fallbackHref?: string; // Fallback when href is omitted & history is empty/external
  label?: ReactNode;     // Visible label (defaults to "← Back")
  ariaLabel?: string;    // Accessible screen reader label (defaults to "Go back")
  className?: string;    // Custom styles
}
```

### Behavior Matrix

| Props Provided | Rendered Element | Action on Click |
| :--- | :--- | :--- |
| `href` provided | `<Link href={href}>` | Client-side navigation directly to `href`. |
| `fallbackHref` only | `<button type="button">` | `router.back()` if internal history exists; otherwise `router.push(fallbackHref)`. |

### External Referrer Guard

When `href` is omitted, `BackButton` checks `document.referrer`:

```typescript
const hasExternalReferrer =
  typeof document !== "undefined" &&
  Boolean(document.referrer) &&
  !document.referrer.startsWith(window.location.origin);

if (window.history.length > 1 && !hasExternalReferrer) {
  router.back();
} else {
  router.push(fallbackHref);
}
```

---

## 3. Screen Navigation Registry

| Route | Button Label | Navigation Strategy | Target |
| :--- | :--- | :--- | :--- |
| `/g/[id]/sessions/[sessionId]` | `← Back to Group` | Deterministic `href` | `/g/[groupId]` |
| `/g/[id]/tournaments/[tournId]` | `← Back to Group` | Deterministic `<Link>` | `/g/[groupId]` |
| `/g/[id]/sessions/new` | `← Back to Group` | Deterministic `<Link>` | `/g/[groupId]` |
| `/g/[id]/tournaments/new` | `← Back to Group` | Deterministic `<Link>` | `/g/[groupId]` |
| `/g/[id]/players` | `← Group Dashboard` | Deterministic `<Link>` | `/g/[groupId]` |
| `/g/[id]` (Group Dashboard) | `← Back` | Conditional `href` | `/players` (if member) or `/` |
| `/players` (Profile) | `← Back` | Deterministic `href` | `/` |

---

## 4. History Stack Guards

1. **Session & Tournament Creation**:
   ```typescript
   // On successful creation:
   router.replace(`/g/${groupId}/sessions/${res.data.id}`);
   ```
2. **Temporary Groups Exit Warning**:
   ```typescript
   // On "Leave without saving":
   router.replace("/");
   ```
   Avoids stacking uncommitted states onto the browser history.

---

## 5. Accessibility (WCAG 2.5.3)

- Default `ariaLabel` is `"Go back"`.
- Context-specific targets can override via `ariaLabel` (e.g. `ariaLabel="Return to group dashboard"`).

# Frontend Integration Guide

This guide maps the screens in [`screens/`](screens/) to the current API. Swagger at the API root documents the full DTO schemas and response examples. If this guide and Swagger differ, use the live API contract and update this guide.

## Connection And Session

- Local base URL: `http://localhost:3000` (or the configured `PORT`); routes have no `/api` prefix. Swagger UI is at `/`.
- Production base URL: `https://codev-osrs-backend.vercel.app/` (routes have no `/api` prefix).
- Set backend `CORS_ORIGINS` to the exact frontend origin. Credentialed browser requests require `credentials: 'include'`.
- Authentication is an HTTP-only `session` cookie. Do not read or persist a token in frontend storage. The cookie lasts eight hours; production sets `Secure` and `SameSite=Lax`. Host the frontend and API on the same site for cookie compatibility.
- Send JSON bodies with `Content-Type: application/json`.
- `POST /auth/google` accepts `{ "credential": "<Google ID token>" }`. It provisions/refreshes the account, sets the cookie, and returns the current user. Role is `admin` or `employee`; select the frontend view using this field.
- `GET /auth/me` restores the current user on app startup. `POST /auth/logout` clears the cookie. Both are safe to call with `credentials: 'include'`.
- A welcome email is sent only when Google sign-in creates a new account. The backend, not the frontend, sends request lifecycle emails.

Use this helper in the examples below. It always includes the session cookie and serializes JSON bodies; set `API_BASE_URL` to localhost or the production URL above.

```ts
type SessionUser = {
  id: number;
  role: 'admin' | 'employee';
  location: string;
};

type ApiProblem = {
  title?: string;
  status?: number;
  detail?: string;
  errors?: Array<{ detail: string; pointer: string }>;
};

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ApiProblem,
  ) {
    super(problem.detail ?? problem.title ?? `API request failed (${status})`);
  }
}

async function apiFetch<T = unknown>(
  path: string,
  options: Omit<RequestInit, 'body' | 'credentials'> & { body?: unknown } = {},
): Promise<T> {
  const { body, ...init } = options;
  const headers = new Headers(init.headers);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}
```

## API Map

| Method | Route | Access | Use |
| --- | --- | --- | --- |
| `POST` | `/auth/google` | Public | Google sign-in and session creation |
| `POST` | `/auth/logout` | Public | Clear session cookie |
| `GET` | `/auth/me` | Signed in | Restore current user/profile |
| `GET` | `/assets` | Employee, admin | Paginated asset catalog and available counts |
| `GET` | `/assets/:id` | Employee, admin | Asset details/specifications |
| `POST` | `/assets` | Admin | Create catalog asset |
| `PATCH` | `/assets/:id` | Admin | Update catalog asset |
| `DELETE` | `/assets/:id` | Admin | Delete asset with no inventory units |
| `GET` | `/inventory-items` | Employee, admin | Paginated physical inventory |
| `GET` | `/inventory-items/:id` | Employee, admin | One inventory unit |
| `POST` | `/inventory-items` | Admin | Add one physical unit |
| `POST` | `/inventory-items/bulk` | Admin | Add 1-100 units for one asset |
| `PATCH` | `/inventory-items/:id` | Admin | Update unit or assignment |
| `DELETE` | `/inventory-items/:id` | Admin | Permanently remove a unit |
| `GET` | `/requests` | Employee, admin | Paginated/filterable request list and queue |
| `GET` | `/requests/counts` | Employee, admin | Status totals for queue filters and summary cards |
| `GET` | `/requests/history` | Admin | Resolved request history |
| `GET` | `/requests/:id` | Employee, admin | Request details and timeline; `id` is numeric |
| `POST` | `/requests` | Employee, admin | Submit request and reserve available units |
| `PATCH` | `/requests/:id` | Admin | Edit purpose or advance workflow |
| `POST` | `/requests/:id/cancel` | Employee, admin | Cancel an eligible request with a reason |
| `POST` | `/requests/:id/receive` | Employee, admin | Mark a handed-over request received |
| `POST` | `/requests/:id/sign` | Employee | Sign the Accountability Form and complete the request |
| `DELETE` | `/requests/:id` | Admin | Soft-delete request; not employee cancellation |
| `GET` | `/users` | Admin | User directory |
| `GET` | `/users/:id` | Admin | One user record |
| `POST` | `/users` | Admin | Create user record |
| `PATCH` | `/users/:id` | Admin | Update user profile, role, or location |
| `DELETE` | `/users/:id` | Admin | Delete user record |

## Shared API Behavior

Paginated lists return `{ data, total, page, limit, totalPages }`; `page` defaults to `1`, `limit` to `10`, and both must be positive integers. Successful create calls return `201`; reads and updates generally return `200`.

Errors use `Content-Type: application/problem+json` and include `title`, `status`, and `type`, with optional `detail`. Validation errors also include `errors`, whose entries have `detail` and a JSON Pointer `pointer` such as `#/items/0/quantity`. Handle `400` invalid input/stock, `401` unauthenticated, `403` wrong role, `404` missing resource, and `409` conflicting state or unique serial.

### Catalog contract

`GET /assets` supports `page`, `limit`, `search` (partial name/model/category), `category`, `location`, and `stockLevel` (`in_stock`, `low_stock`, `out_of_stock`). Categories are exactly `Laptop`, `Headset`, `Monitor`, `Phone`, `UPS`, `Mice`, `Wifi`, `Type C Hub`, and `Other Devices`; the API spelling is `Wifi` even if the UI says WiFi. Locations are `Cebu`, `Bacolod`, `Makati`, `Ortigas`, and `Davao`.

Asset results include `id`, `category`, `name`, `model`, `description`, category-specific specs (`ram`, `processor`, `graphics`, `operatingSystem`, `storage`), `imageBase64`, `lowQtyAlert`, and `quantity`. `quantity` counts inventory units with status `Available`; optional `location` scopes list counts. `GET /assets/:id` always reports quantity across all offices. Derive stock labels as out when quantity is `0`, low when it is from `1` through `lowQtyAlert`, and available when it is greater than the threshold.

The API has one string `model` per asset and no model-variant endpoint. Category-specific add forms map to the same asset DTO; send the chosen category and the applicable specification fields. Physical stock is managed separately from catalog definitions.

### Inventory contract

`GET /inventory-items` supports `page`, `limit`, `search`, `category`, `status`, and `assignedToId`; it returns each unit with its related asset. Status values are `Available`, `Reserved`, `Assigned`, and `Inactive`. There is no location filter on this list endpoint.

Single-unit create accepts `assetId`, required `location`, and optional `price`, `supplier`, `purchasedAt`, `serialNumber`, `bitlockerIdentifier`, `recoveryPin`, `assignedToId`, `description`, and `attachmentUrl`. A unit created with an assignee starts `Assigned`; otherwise it starts `Available`.

Bulk create uses `POST /inventory-items/bulk` with shared asset/location/purchase fields and a `units` array of per-unit serial/BitLocker identifiers. The array must contain 1-100 units. Serials must be unique. Updating with `assignedToId: null` clears assignment and makes a unit `Available`; omission leaves the assignment unchanged. Delete is a permanent inventory-unit removal.

### Request contract and workflow

`GET /requests` supports `page`, `limit`, `status`, partial `displayId`, partial `requester` (name/email), `requesterId`, partial `itemName`, and `sort` (`newest`, `oldest`, `employee_name_asc`). Returned request lines include `asset`, `quantity`, and current `availableStock`.

Submit `POST /requests` with at least one unique asset line. Each `assetId` and `quantity` must be a positive integer; `purpose` is optional and limited to 500 characters.

```json
{
  "purpose": "temporary project setup",
  "items": [
    { "assetId": 1, "quantity": 1 },
    { "assetId": 6, "quantity": 2 }
  ]
}
```

The API atomically reserves units and returns a request in `pending_approval`. If stock changed, submission returns `400`; retain the list, explain the problem, and refresh availability. Request statuses are `pending_approval`, `approved`, `ready_for_pickup`, `for_delivery`, `received`, `rejected`, `completed`, and `cancelled`. Employees see only their own requests; admins see all requests. Admin transitions are pending to approved/rejected, approved to ready-for-pickup/for-delivery, and the two release statuses may switch between each other. A handed-over request moves to `received` through `/receive`, then the employee signs through `/sign` to move it to `completed`. Employees may cancel their own pending requests; admins may cancel approved or handed-over requests that have not yet been received. Rejection and cancellation require a reason; invalid transitions return `409`. `items` and quantities cannot be changed after submission.

`PATCH /requests/:id` is admin-only. Example bodies: `{ "status": "approved" }`, `{ "status": "rejected", "rejectionReason": "Duplicate request" }`, `{ "status": "ready_for_pickup", "pickupLocation": "6th floor IT desk" }`, and `{ "status": "for_delivery" }`. Use `POST /requests/:id/receive` for handover and `POST /requests/:id/sign` for the Accountability Form. Use `POST /requests/:id/cancel` with `{ "reason": "No longer needed" }` when cancellation is allowed. Approval keeps units reserved until handover; receiving assigns them to the requester, while rejecting or cancelling returns reserved units to available stock.

Use `GET /requests/counts` for `total`, per-status `byStatus` counts, and `inProcessing`. Use `GET /requests/history` for completed, rejected, and cancelled requests sorted by `resolvedAt`.

## Employee Screens

### Login

![Employee login](screens/employee-view/login-screen.png)

The Google button obtains an ID-token credential and posts it to `/auth/google`. Show an error for `401` invalid credentials or `403` unverified/out-of-domain/deleted accounts. After success, retain the returned user in application state and route according to `role`. On reload, use `/auth/me`; show login when it returns `401`.

```ts
const signedInUser = await apiFetch<SessionUser>('/auth/google', {
  method: 'POST',
  body: { credential: googleIdToken },
});
// Route using signedInUser.role; the API sets the session cookie.

const restoredUser = await apiFetch<SessionUser>('/auth/me');
```

### Catalog, Specs, And Request List

![Employee catalog](screens/employee-view/catalog-screen.png)

Search/filter with `GET /assets`; pass `search`, exact `category`, and optionally the current user's `location`. Omit category for All. Use `data`, pagination metadata, `quantity`, and `lowQtyAlert` to render cards, filters, stock states, and limits. For View Specs, call `GET /assets/:id` and show non-null specs and image; keep the catalog row's location-scoped quantity if the list was filtered by location.

```ts
const catalogParams = new URLSearchParams({ page: '1', limit: '12' });
if (search.trim()) catalogParams.set('search', search.trim());
if (category) catalogParams.set('category', category);
if (currentUser.location) catalogParams.set('location', currentUser.location);
const catalogPage = await apiFetch(`/assets?${catalogParams}`);
```

The request list is client-side state; there is no cart/draft endpoint. Store one line per asset ID, allow quantity/removal operations locally, and derive the header count from that list. Submit it using the request payload above. Clear local state only after `POST /requests` succeeds.

![View specs drawer](screens/employee-view/catalog-screen-view-specs.png)

```ts
const assetDetails = await apiFetch(`/assets/${assetId}`);
```

![Request list drawer](screens/employee-view/catalog-screen-request-list.png)

```ts
const submittedRequest = await apiFetch('/requests', {
  method: 'POST',
  body: {
    purpose: approverNote || undefined,
    items: requestItems.map(({ assetId, quantity }) => ({ assetId, quantity })),
  },
});
```

![Submitted request confirmation](screens/employee-view/catalog-screen-request-list-submitted.png)

The confirmation uses the POST response: `displayId`, `status`, `createdAt`, `items[].asset`, `items[].quantity`, `purpose`, and `timeline`. Store numeric `id` for later detail fetches; `/requests/:id` does not accept `displayId`. For stock errors, keep the drawer open and let the employee adjust quantities. To reload the panel later:

```ts
const requestDetails = await apiFetch(`/requests/${requestId}`);
```

### My Requests And View Request

![My Requests](screens/employee-view/my-requests-screen.png)

Call `GET /auth/me`, then `GET /requests?requesterId=<user.id>&sort=newest&page=1&limit=10` with credentials. Optional filters are `status`, `displayId`, and `itemName`. Render `displayId`, status, `createdAt`, item asset names/models/quantities, purpose, and rejection reason; use pagination metadata. Open a row with `GET /requests/:id` using the numeric ID. Detail data includes requester, lines, current available stock, review information, purpose, rejection reason, and recorded timeline.

```ts
const currentUser = await apiFetch<SessionUser>('/auth/me');
const requestParams = new URLSearchParams({
  requesterId: String(currentUser.id),
  page: String(page),
  limit: '10',
  sort: 'newest',
});
if (statusFilter) requestParams.set('status', statusFilter);
const myRequests = await apiFetch(`/requests?${requestParams}`);
```

![Pending request detail](screens/employee-view/my-requests-screen-view-request-pending-approval.png)

```ts
const requestDetails = await apiFetch(`/requests/${requestId}`);
```

Other supplied detail states: [received](screens/employee-view/my-requests-screen-view-request-received.png), [cancelled](screens/employee-view/my-requests-screen-view-request-cancelled.png), [cancel attempt while pending](screens/employee-view/my-requests-screen-view-request-pending-approval-cancel-attempt.png), and [accountability form](screens/employee-view/my-requests-screen-view-request-accountability-form.png).

Employee request list results are scoped to the signed-in employee, regardless of the supplied `requesterId`; request detail also returns `404` for another employee's request. Use `POST /requests/:id/cancel` for employee cancellation; `DELETE /requests/:id` remains admin-only soft deletion. The accountability form submits `agreed: true`, the typed `fullName`, and optional `notes` to `POST /requests/:id/sign` after the request is received. `POST /requests/:id/receive` may be used by the requester or an admin for a ready-for-pickup or for-delivery request.

Status mapping: `pending_approval` -> Pending Approval; `approved` -> Approved; `ready_for_pickup` -> Ready for Pickup; `for_delivery` -> For Delivery; `received` -> Received; `rejected` -> Rejected; `completed` -> Complete; `cancelled` -> Cancelled. Timeline shows recorded events, not future milestones.

### Profile

![Employee profile](screens/employee-view/profile-screen.png)

Use `GET /auth/me` for the signed-in employee's identity, avatar, role, and office. No self-service profile update endpoint exists. `/users/:id` mutations are admin-only; do not send employee profile edits there.

```ts
const profile = await apiFetch<SessionUser>('/auth/me');
const assignedItems = await apiFetch(
  `/inventory-items?assignedToId=${profile.id}`,
);
```

## Admin Screens

![Admin login](screens/admin-view/login-screen.png)

Admin login uses the same Google flow. The API assigns `admin` to configured `ADMIN_EMAILS`; all admin functions require an admin session. A user with an employee role receives `403` on admin routes.

### Asset Catalog Management

![Admin assets](screens/admin-view/assets-screen.png)

Use `GET /assets` for the paginated list and its search/category/location/stock filters. `POST /assets` creates a catalog definition only; `PATCH /assets/:id` updates it; `DELETE /assets/:id` fails with `409` while any inventory unit references the asset. Quantity is derived from inventory and cannot be changed via asset updates.

```ts
const assetParams = new URLSearchParams({ page: '1', limit: '10', search: 'Laptop' });
const assetPage = await apiFetch(`/assets?${assetParams}`);
```

Create requires `name`, `category`, and `model`; optional fields are `description`, `imageBase64`, `ram`, `processor`, `graphics`, `operatingSystem`, `storage`, and `lowQtyAlert` (defaults to 5; minimum 0). Update is partial; send `null` to clear nullable image/specification fields. The category-specific forms do not imply separate API routes.

![Asset details](screens/admin-view/assets-screen-view-asset.png)

```ts
const asset = await apiFetch(`/assets/${assetId}`);
```

Asset form variants: [Laptop](screens/admin-view/assets-screen-add-asset-laptop.png), [Headset](screens/admin-view/assets-screen-add-asset-headset.png), [Mice](screens/admin-view/assets-screen-add-asset-mice.png), [Other Device](screens/admin-view/assets-screen-add-asset-other-device.png), [Phone](screens/admin-view/assets-screen-add-asset-phone.png), [Type-C Hub](screens/admin-view/assets-screen-add-asset-type-c-hub.png), [UPS](screens/admin-view/assets-screen-add-asset-ups.png), and [WiFi](screens/admin-view/assets-screen-add-asset-wifi.png). The update form is [here](screens/admin-view/assets-screen-update-asset.png).

```ts
const createdAsset = await apiFetch('/assets', {
  method: 'POST',
  body: {
    name: 'Business Laptop',
    category: 'Laptop',
    model: 'Dell Latitude 5440',
    description: '14-inch business laptop',
    ram: '16GB',
    processor: 'Intel Core i7-1355U',
    graphics: 'Intel Iris Xe Graphics',
    operatingSystem: 'Windows 11 Pro',
    storage: '512GB SSD',
    lowQtyAlert: 5,
  },
});

const updatedAsset = await apiFetch(`/assets/${assetId}`, {
  method: 'PATCH',
  body: { lowQtyAlert: 4, description: null },
});

await apiFetch(`/assets/${assetId}`, { method: 'DELETE' });
```

### Inventory Management

![Admin inventory](screens/admin-view/inventory-screen.png)

Load and filter with `GET /inventory-items`. Add one unit with `POST /inventory-items`; add a 1-100 unit batch with `POST /inventory-items/bulk`. Map catalog selection to `assetId`, office to `location`, and purchase/identifier/assignment fields to the create DTO. The unit endpoint returns the related asset and actual lifecycle status.

```ts
const inventoryParams = new URLSearchParams({
  page: '1', limit: '10', search: 'Latitude', status: 'Available',
});
const inventoryPage = await apiFetch(`/inventory-items?${inventoryParams}`);
```

For edits, call `PATCH /inventory-items/:id`; omit unchanged fields. `assignedToId: null` unassigns and returns the unit to Available. The users directory (`GET /users`, admin-only) supplies assignable users. For removal, use `DELETE /inventory-items/:id` only after the screen's confirmation; this is a permanent unit deletion.

```ts
const unit = await apiFetch(`/inventory-items/${inventoryItemId}`);
const assignableUsers = await apiFetch('/users');

const createdUnit = await apiFetch('/inventory-items', {
  method: 'POST',
  body: {
    assetId: 1,
    location: 'Cebu',
    serialNumber: 'PF3ABCXY',
    price: 1299.99,
    supplier: 'Example Supplier',
    purchasedAt: '2026-01-15T00:00:00.000Z',
  },
});

const createdUnits = await apiFetch('/inventory-items/bulk', {
  method: 'POST',
  body: {
    assetId: 1,
    location: 'Cebu',
    supplier: 'Example Supplier',
    units: [{ serialNumber: 'PF3ABCXY' }, { serialNumber: 'PF3ABCDZ' }],
  },
});

const updatedUnit = await apiFetch(`/inventory-items/${inventoryItemId}`, {
  method: 'PATCH',
  body: { assignedToId: null, location: 'Makati' },
});

await apiFetch(`/inventory-items/${inventoryItemId}`, { method: 'DELETE' });
```

Inventory screen variants: [add menu](screens/admin-view/inventory-screen-add-inventory-dropdown.png), [single unit](screens/admin-view/inventory-screen-add-single-unit.png), [single unit with catalog selected](screens/admin-view/inventory-screen-add-single-unit-catalog-selected.png), [bulk add](screens/admin-view/inventory-screen-bulk-add-units.png), [review/edit available](screens/admin-view/inventory-screen-review-or-edit-available.png), [review/edit assigned](screens/admin-view/inventory-screen-review-or-edit-assigned.png), [delete](screens/admin-view/inventory-screen-delete-unit.png), and [delete confirmation](screens/admin-view/inventory-screen-delete-unit-confirmation.png).

### Request Queue And Review

![Admin request queue](screens/admin-view/requests-queue-screen.png)

Use `GET /requests` with pagination and any combination of `status`, `displayId`, `requester`, `requesterId`, and `itemName`. Sort by `newest`, `oldest`, or `employee_name_asc`. Open a request with `GET /requests/:id` and use `PATCH /requests/:id` for admin actions. Do not call the update endpoint for employee actions.

```ts
const queueParams = new URLSearchParams({
  page: '1', limit: '10', sort: 'newest', status: 'pending_approval',
});
const queue = await apiFetch(`/requests?${queueParams}`);
const request = await apiFetch(`/requests/${requestId}`);
```

Request review states: [pending approval](screens/admin-view/requests-queue-screen-review-request-pending-approval.png), [approved](screens/admin-view/requests-queue-screen-review-request-approved.png), [rejected](screens/admin-view/requests-queue-screen-review-request-rejected.png), and [for delivery](screens/admin-view/requests-queue-screen-review-request-for-delivery.png). The sort menu is [shown here](screens/admin-view/requests-queue-screen-sort-menu.png); invalid delivery and rejection attempts are [here](screens/admin-view/requests-queue-screen-review-request-for-delivery-attempt.png) and [here](screens/admin-view/requests-queue-screen-review-request-reject-attempt.png).

Approve using `{ "status": "approved" }`; reject using `{ "status": "rejected", "rejectionReason": "..." }`; then advance approved requests to `ready_for_pickup` or `for_delivery`, and finally to `completed`. A rejection reason is required. The API controls transitions and reservation changes; display `409` conflicts from stale/invalid actions and refresh request detail. Requested line items and quantities are immutable after submission.

```ts
await apiFetch(`/requests/${requestId}`, {
  method: 'PATCH', body: { status: 'approved' },
});
await apiFetch(`/requests/${requestId}`, {
  method: 'PATCH', body: { status: 'rejected', rejectionReason: 'Duplicate request' },
});
await apiFetch(`/requests/${requestId}`, {
  method: 'PATCH', body: { status: 'ready_for_pickup' },
});
await apiFetch(`/requests/${requestId}`, {
  method: 'PATCH', body: { status: 'for_delivery' },
});
await apiFetch(`/requests/${requestId}`, {
  method: 'PATCH', body: { status: 'completed' },
});
```

### Request History

![Admin history](screens/admin-view/history-screen.png)

Use `GET /requests/history` with the same search and paging filters as the queue. It returns completed, rejected, and cancelled requests and sorts newest or oldest by `resolvedAt`. The [history item view](screens/admin-view/history-screen-view-history-item.png) maps to request detail and its `timeline`. Soft-deleted requests remain excluded.

To soft-delete a request from an authorized admin workflow, require explicit confirmation, then call:

```ts
await apiFetch(`/requests/${requestId}`, { method: 'DELETE' });
```

### User Directory And Assignment

There is no user-management screenshot, but the API exposes admin-only `/users` routes. Use `GET /users` to populate assignment and requester references. `POST /users` requires email, first/last name, avatar URL, role, and location; `PATCH /users/:id` updates first/last name, avatar, role, or location. `DELETE /users/:id` deletes an account. Locations are `Cebu`, `Bacolod`, `Makati`, `Ortigas`, and `Davao`; roles are `employee` and `admin`.

```ts
const users = await apiFetch('/users');
const userRecord = await apiFetch(`/users/${userId}`);

const createdUser = await apiFetch('/users', {
  method: 'POST',
  body: {
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: 'https://example.com/ada.png',
    role: 'employee',
    location: 'Cebu',
  },
});

const updatedUser = await apiFetch(`/users/${userId}`, {
  method: 'PATCH',
  body: { role: 'admin', location: 'Makati' },
});

await apiFetch(`/users/${userId}`, { method: 'DELETE' });
```

## Email Designs And API Triggers

Email assets are references for messages the backend sends automatically; there are no frontend email or notification endpoints. Submission sends a confirmation to the requester and an approval-needed email to admins. Admin status changes send the matching requester email. Delivery is best-effort and does not roll back a saved request.

| Trigger | Email design |
| --- | --- |
| New account created on Google sign-in | [Welcome](screens/employee-view/email-welcome.png) |
| Request submitted | [Pending approval confirmation](screens/employee-view/email-request-pending-approval.png) |
| Request submitted, admin notification | [Admin approval needed](screens/admin-view/email-request-pending-approval.png) |
| Admin approves | [Approved](screens/employee-view/email-request-approved.png) |
| Admin rejects | [Rejected](screens/employee-view/email-request-rejected.png) |
| Admin sets `ready_for_pickup` | [Ready for pickup](screens/employee-view/email-request-ready-for-pickup.png) |
| Admin sets `for_delivery` | [For delivery](screens/employee-view/email-request-for-delivery.png) |
| Admin sets `completed` | [Completed](screens/employee-view/email-request-completed.png) |

The supplied [received email design](screens/employee-view/email-request-received.png) is sent when a request moves to `received`. Cancellation and completion also send lifecycle emails; there are no frontend email or notification endpoints.

## Missing Screen Integrations

Notification-bell data and self-service profile editing remain unsupported. The History endpoint is request history, not a general audit feed, and soft-deleted requests are excluded. Do not map unsupported actions to unrelated operations such as request rejection or admin soft deletion.
# CleClo Backend Requirements Audit

Audit date: `2026-05-01`

This document is simplified into two parts:

- `Done`: backend support already exists
- `Not Done`: backend support is missing or not fully built

## Done

### Admin login, security, and role access

- Role-based admin access:
  - `super_admin`
  - `operations_admin`
  - `finance_admin`
- Admin login with OTP challenge flow
- Login attempt limiter
- CAPTCHA after repeated failed attempts
- Remember Me support
- Last login data in admin login response
- Login IP tracking
- Login location tracking
- Admin permissions by role on protected routes

### Admin dashboard and KPIs

- Time filters:
  - Today
  - Yesterday
  - This Week
  - This Month
  - Custom Date Range
- KPI support for:
  - Orders
  - Revenue
  - Pending Orders
  - Issue Count
  - Avg Order Value
  - Vendor Payout Due
  - Settlement Pending Amount
- Gross revenue and commission data
- Role-based dashboard response by admin role
- Dashboard finance snapshot support

### Order operations backend

- Create order
- Price check
- Upload order image
- Get customer orders
- Get single order
- Update customer order status
- Admin order listing
- Admin order status update
- Assign vendor to order
- Assign rider to order
- Report issue on order
- Resolve issue on order
- Vendor order listing
- Vendor order status update
- Vendor accept order
- Vendor mark ready for delivery

### Issue alerts backend

- Dedicated issue alert APIs
- Severity support:
  - Critical
  - High
  - Medium
  - Low
- Filters for:
  - City
  - Vendor
  - Issue Type
  - Date
  - Status
  - Severity
- Assign issue to team member
- Escalate issue
- Mark issue resolved
- Mark all issues reviewed
- Root cause classification:
  - Vendor Fault
  - Rider Fault
  - Customer Fault
  - System Issue
- Refund status tracking:
  - Not Initiated
  - Processing
  - Completed
- Financial risk amount support
- Damage claim support:
  - damage image
  - pre-clean image
  - invoice value
  - liability cap
- Monthly issue summary data

### Vendor management

- Vendor registration
- Pending vendor approvals
- Approve vendor
- Suspend vendor
- Vendor payouts listing
- Vendor profile update
- Internal notes field
- Inspection status field
- Onboarding step field
- Agreement/document timeline fields:
  - documents uploaded
  - documents verified
  - agreement signed
- Rejection reason field
- Bank verified field
- GST registration fields
- Daily capacity field
- Area coverage field

### Customer and user management

- User listing with role/status filters
- User search
- Get single user
- Update user
- Block/unblock user
- Reset password
- Get user addresses
- Get user wallet
- Adjust wallet balance
- Adjust loyalty points
- Payment method CRUD
- Address CRUD
- Support ticket create/list/update

### Catalog, services, items, and pricing

- Services CRUD
- Categories CRUD
- Subcategories CRUD
- Items CRUD
- Active/inactive support
- Soft archive behavior through `isActive = false`
- Service-level default processing time
- Express option allowed
- Surge pricing allowed
- Service-level commission percentage
- City-based visibility fields
- Vendor-based availability fields
- Limited-time availability fields
- Bulk item upload API
- Bulk item price update API
- Price preview API
- City-wise pricing overrides
- Vendor-wise pricing overrides
- GST percentage support
- Updated-by / created-by metadata fields

### Content and campaign management

- Banner CRUD
- Video CRUD
- Campaign CRUD
- Banner scheduling
- City targeting
- Vendor targeting
- User segment targeting
- Priority ranking
- Referral campaign CRUD
- Referral reward amount support
- First order condition support
- Minimum cart value support
- City-specific referral targeting

### Wallet and reward configuration

- Wallet min/max add money config
- Bonus enabled config
- Reward rule CRUD
- Reward expiry rule support
- Wallet liability summary
- Promotional liability calculation
- Cash liability calculation

### Location configuration

- City CRUD
- Area CRUD
- Time slot CRUD
- State lookup
- City-by-state lookup
- Enable/disable city support
- Pickup time slots per city
- Delivery time slots per city
- Area surge pricing
- Location and slot validation before order creation

### Settlements and finance basics

- Settlement list API
- Settlement stats API
- Create settlement
- Update settlement
- Mark settlement paid
- Settlement statuses:
  - pending
  - processing
  - paid
  - failed
- Gross amount field
- Commission amount field
- Net payout amount field
- Failure reason field
- Settlement cycle field
- Tax deducted field
- Payment mode field in schema
- Refund adjustment / penalties fields in schema
- Auto reconciliation field in schema

## Not Done

### Real integrations and delivery

- Real email sending for admin OTP
- Real WhatsApp sending for admin OTP
- Real email alert for new login detected
- Real WhatsApp alert for new login detected

### Frontend-only items not handled by backend

- Cleclo logo / Admin Dashboard branding
- Revised login microcopy
- Caps Lock indicator
- Inline password UX behavior
- Loading spinner on Secure Login button
- Button hover animation / gradients / shadows
- Bottom text visual replacement
- Standalone page layout/styling changes
- Popup/modal interactions
- Clickable UI behavior itself

### Rider / fleet backend

- Dedicated rider module
- Rider onboarding workflow
- Rider verification workflow
- Rider document upload and expiry tracking
- Rider background verification
- Rider vehicle details and capacity model
- Rider zone assignment
- Rider outlet assignment
- Rider availability states:
  - online
  - on delivery
  - offline
  - suspended
- Rider productivity analytics
- Rider earnings analytics
- Rider payout workflow
- Rider fraud detection
- Rider incident tracking
- Rider health score
- Rider utilization analytics
- Live rider tracking / GPS routes

### Bulk operations

- Bulk assign vendor to orders
- Bulk assign rider to orders
- Bulk change order status
- Bulk export orders
- Bulk notify customers
- Bulk settlement processing
- Bulk payout release workflow
- Bulk category change in catalog
- Bulk CSV import/export endpoints
- Bulk activate/deactivate dedicated APIs

### Order operations not built yet

- SLA countdown timer backend for each order
- Unassigned-order aging alert logic
- Delay reason workflow
- Allocation strategy engine:
  - nearest rider
  - lowest workload
  - highest rating
- Allocation settings backend
- Order profitability API with complete margin breakdown
- Live dispatch map / route APIs

### Issue alert automation still not fully built

- True background auto-escalation worker after X hours
- Automatic escalation job runner
- Full vendor risk scoring engine
- Full payout hold based on issue risk
- One-click action APIs for:
  - contact vendor
  - call customer
  - open order action route

### Support workflow gaps

- Internal notes vs vendor-visible replies separation
- Linked order ID on support tickets as first-class field
- Linked transaction ID on support tickets as first-class field
- Ticket source tracking:
  - vendor dashboard
  - customer app
  - rider app
  - email
  - admin dashboard
- Auto-created tickets from payout failure
- Auto-created tickets from SLA breach
- Auto-created tickets from bad rating
- Repeat ticket detection
- Support health score
- Predefined support reply templates
- Multi-role assignment on support tickets
- Dispute workflow engine

### Vendor analytics and compliance gaps

- Vendor tier engine:
  - Gold
  - Silver
  - Probation
- Agreement expiry tracking
- Complete KYC checklist workflow
- Complete GST checklist workflow
- Complete service capability checklist workflow
- Priority tag engine:
  - High Risk
  - Incomplete Documents
  - Ready to Activate
- Geo map API for outlet/vendor views
- Full outlet analytics backend
- Outlet onboarding workflow engine

### Customer analytics gaps

- Customer segmentation engine:
  - VIP
  - Gold
  - Silver
  - At Risk
  - Dormant
- Lifetime value calculation API
- Churn tracking API
- Registration source tracking:
  - organic
  - referral
  - campaign
- Internal customer notes system
- Detailed complaint history APIs

### Finance and settlement gaps

- Vendor ledger API
- Invoice/PDF generation for settlements
- Processed by / approved by audit log
- Payout hold workflow
- Working capital forecast API
- Settlement aging API
- Financial health score API
- Reconciliation workflow UI/backend actions
- GST/TDS invoice generation workflow
- Vendor profitability analytics per settlement

### Catalog and pricing control gaps

- Minimum price protection validation
- Loss-making warning enforcement
- Duplicate item action
- Duplicate service/category/content action
- CSV download endpoints
- Strong bulk archive workflow

### Content management gaps

- Preview App View backend
- Content preview endpoint
- Duplicate banner/video/campaign action

### Multi-city advanced configuration gaps

- City-level commission configuration engine
- City-level SLA configuration engine
- Rider base rate by city
- Express pricing by city as dedicated config module

## Final Summary

### Backend is already done for

- Admin auth and role security foundation
- Orders basic workflow
- Issue alerts core backend
- Vendor/customer/user/catalog/wallet/location/settlement core modules

### Backend is not done for

- Real integrations
- Rider/fleet systems
- Deep automation
- Bulk operations
- Advanced finance workflows
- Advanced support workflows
- Preview and frontend behavior items

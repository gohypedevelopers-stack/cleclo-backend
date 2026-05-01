# CleClo Backend API Testing Guide

This file is written for Postman testing against the current codebase.

## Base URLs

Use these values in a Postman environment:

```json
{
  "gatewayUrl": "http://localhost:3000",
  "authServiceUrl": "http://localhost:3001",
  "catalogServiceUrl": "http://localhost:3002",
  "orderServiceUrl": "http://localhost:3003",
  "adminToken": "",
  "customerToken": "",
  "vendorId": "",
  "userId": "",
  "orderId": "",
  "itemId": "",
  "slotId": "",
  "cityCode": ""
}
```

## Important Routing Note

The API gateway only proxies these groups:

- `/api/auth`
- `/api/admin/auth`
- `/api/catalog`
- `/api/admin/catalog`
- `/api/orders`
- `/api/admin/orders`

These routes are **not** exposed through the gateway and should be tested directly on service ports:

- Auth service direct routes: `/vendor`, `/tickets`, `/addresses`, `/payment-methods`
- Order service direct routes: `/vendor/orders`, `/internal/orders`

## Auth Headers

Admin protected routes require:

```http
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

There is no customer/vendor auth middleware on most customer/vendor routes yet, so many of them currently accept IDs in params/query/body.

## Quick Postman Flow

1. Create a customer with `POST {{gatewayUrl}}/api/auth/signup`
2. Login customer with `POST {{gatewayUrl}}/api/auth/login`
3. Fetch catalog with `GET {{gatewayUrl}}/api/catalog/services`
4. Fetch cities and slots with catalog endpoints
5. Create an order with `POST {{gatewayUrl}}/api/orders`
6. Login admin with OTP flow
7. Use admin token for `/api/admin/auth/*`, `/api/admin/catalog/*`, `/api/admin/orders/*`

---

## 1. Health Endpoints

### Gateway

- `GET {{gatewayUrl}}/health`

Response:

```json
{
  "status": "API Gateway is running"
}
```

### Services

- `GET {{authServiceUrl}}/health`
- `GET {{catalogServiceUrl}}/health`
- `GET {{orderServiceUrl}}/health`

---

## 2. Customer Auth APIs

### Signup

- `POST {{gatewayUrl}}/api/auth/signup`

Body:

```json
{
  "name": "Test Customer",
  "email": "customer1@example.com",
  "phone": "9876543210",
  "password": "Password@123",
  "address": "12 MG Road, Bengaluru",
  "lat": 12.9716,
  "lng": 77.5946,
  "image": "https://example.com/profile.jpg"
}
```

Success response:

```json
{
  "message": "User created successfully",
  "token": "jwt-token",
  "user": {
    "id": "user-uuid",
    "name": "Test Customer",
    "email": "customer1@example.com",
    "phone": "9876543210",
    "role": "customer"
  }
}
```

### Login

- `POST {{gatewayUrl}}/api/auth/login`

Body:

```json
{
  "email": "customer1@example.com",
  "password": "Password@123"
}
```

Success response:

```json
{
  "message": "Login successful",
  "token": "jwt-token",
  "user": {
    "id": "user-uuid",
    "role": "customer"
  }
}
```

### Send OTP

- `POST {{gatewayUrl}}/api/auth/send-otp`

Body:

```json
{
  "phone": "9876543210"
}
```

Response:

```json
{
  "message": "OTP sent successfully (Mock: 1234)"
}
```

### Verify OTP

- `POST {{gatewayUrl}}/api/auth/verify-otp`

Body:

```json
{
  "phone": "9876543210",
  "otp": "1234"
}
```

Response:

```json
{
  "message": "OTP Verified"
}
```

### Vendor Registration

- `POST {{gatewayUrl}}/api/auth/vendor/register`

Body:

```json
{
  "name": "Vendor User",
  "email": "vendor1@example.com",
  "phone": "9999999999",
  "password": "Password@123",
  "businessName": "Quick Wash",
  "gstRegistered": true,
  "gstNumber": "29ABCDE1234F1Z5",
  "businessType": "Partnership",
  "servicesOffered": "Dry Clean, Wash & Fold",
  "outletName": "Quick Wash Main Outlet",
  "outletAddress": "45 Residency Road, Bengaluru",
  "lat": 12.9701,
  "lng": 77.5933,
  "operatingHours": "09:00-21:00",
  "dailyCapacity": 100,
  "bankHolderName": "Vendor User",
  "bankName": "HDFC Bank",
  "accountNumber": "123456789012",
  "ifscCode": "HDFC0001234",
  "termsAccepted": true,
  "slaAccepted": true
}
```

Response:

```json
{
  "message": "Vendor registered successfully",
  "userId": "vendor-user-uuid"
}
```

### Update Customer Profile

- `PATCH {{gatewayUrl}}/api/auth/profile/{{userId}}`

Body:

```json
{
  "name": "Updated Customer",
  "email": "customer1-updated@example.com",
  "phone": "9876500000"
}
```

Response:

```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "user-uuid",
    "name": "Updated Customer"
  }
}
```

---

## 3. Admin Auth APIs

Use these role values:

```json
{
  "requestedRole": "super_admin"
}
```

Valid roles:

- `super_admin`
- `operations_admin`
- `finance_admin`

### Step 1: Admin Login

- `POST {{gatewayUrl}}/api/auth/admin/login`

Body:

```json
{
  "identifier": "admin@example.com",
  "password": "Password@123",
  "requestedRole": "super_admin",
  "deliveryChannel": "email"
}
```

Success response:

```json
{
  "message": "OTP sent via email.",
  "requiresOtp": true,
  "challengeId": "challenge-uuid",
  "expiresAt": "2026-05-01T10:00:00.000Z",
  "maskedTarget": "a***@example.com",
  "deliveryChannel": "email",
  "requestedRole": "super_admin",
  "debugOtp": "123456"
}
```

If many failures happen, the response can require CAPTCHA:

```json
{
  "message": "Additional security verification is required.",
  "captchaRequired": true,
  "failedAttempts": 3,
  "attemptsRemaining": 2,
  "captcha": {
    "challengeId": "captcha-uuid",
    "prompt": "8 + 3 = ?",
    "expiresAt": "2026-05-01T10:00:00.000Z"
  }
}
```

### Step 2: Verify Admin OTP

- `POST {{gatewayUrl}}/api/auth/admin/verify-otp`

Body:

```json
{
  "challengeId": "challenge-uuid",
  "otpCode": "123456",
  "rememberMe": true
}
```

Success response:

```json
{
  "message": "Login successful.",
  "token": "admin-jwt-token",
  "expiresAt": "2026-05-31T10:00:00.000Z",
  "user": {
    "id": "admin-user-uuid",
    "name": "Super Admin",
    "email": "admin@example.com",
    "phone": "9000000000",
    "role": "admin",
    "adminRole": "super_admin"
  },
  "permissions": {
    "adminRole": "super_admin",
    "roleLabel": "Super Admin"
  }
}
```

### Change Admin Password

- `POST {{gatewayUrl}}/api/admin/auth/auth/change-password`

Body:

```json
{
  "currentPassword": "OldPassword@123",
  "newPassword": "NewPassword@123"
}
```

Response:

```json
{
  "message": "Password updated successfully."
}
```

### Update Admin Profile

- `PATCH {{gatewayUrl}}/api/admin/auth/auth/update-profile`

Body:

```json
{
  "name": "Updated Admin",
  "email": "admin-updated@example.com",
  "phone": "9000000001",
  "image": "https://example.com/admin.png"
}
```

Response:

```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "admin-user-uuid",
    "name": "Updated Admin"
  }
}
```

---

## 4. Admin User, Vendor, Wallet, Referral, Settlement APIs

All routes below require `Authorization: Bearer {{adminToken}}`.

### Internal/Public Admin Search

- `POST {{gatewayUrl}}/api/admin/auth/users/by-ids`

Body:

```json
{
  "ids": ["user-uuid-1", "user-uuid-2"]
}
```

- `GET {{gatewayUrl}}/api/admin/auth/users/search?query=test`

### Dashboard

- `GET {{gatewayUrl}}/api/admin/auth/dashboard/overview`
- `GET {{gatewayUrl}}/api/admin/auth/dashboard/stats`
- `GET {{gatewayUrl}}/api/admin/auth/notifications`
- `GET {{gatewayUrl}}/api/admin/auth/vendors/weekly-activity`

Typical response shape:

```json
{
  "totalUsers": 120,
  "totalVendors": 18
}
```

### Issue Alerts

- `GET {{gatewayUrl}}/api/admin/auth/issues`
- `POST {{gatewayUrl}}/api/admin/auth/issues/review-all`
- `PATCH {{gatewayUrl}}/api/admin/auth/issues/{{issueId}}`

Patch body:

```json
{
  "status": "Resolved",
  "assignedTo": "ops-admin",
  "rootCause": "Vendor delay"
}
```

### Users

- `GET {{gatewayUrl}}/api/admin/auth/users`
- `GET {{gatewayUrl}}/api/admin/auth/users?role=customer&status=active`
- `GET {{gatewayUrl}}/api/admin/auth/users/{{userId}}`
- `PUT {{gatewayUrl}}/api/admin/auth/users/{{userId}}`
- `PATCH {{gatewayUrl}}/api/admin/auth/users/{{userId}}/block`
- `GET {{gatewayUrl}}/api/admin/auth/users/{{userId}}/addresses`
- `POST {{gatewayUrl}}/api/admin/auth/users/{{userId}}/reset-password`

Update body:

```json
{
  "name": "Edited User",
  "email": "edited@example.com",
  "phone": "9876500011",
  "userType": "regular",
  "status": "active"
}
```

Block body:

```json
{
  "blocked": true
}
```

Reset password body:

```json
{
  "newPassword": "ResetPassword@123"
}
```

### Wallet and Loyalty

- `GET {{gatewayUrl}}/api/admin/auth/users/{{userId}}/wallet`
- `POST {{gatewayUrl}}/api/admin/auth/users/{{userId}}/wallet`
- `POST {{gatewayUrl}}/api/admin/auth/users/{{userId}}/loyalty/adjust`

Wallet adjust body:

```json
{
  "amount": 250,
  "type": "credit",
  "note": "Manual refund"
}
```

Loyalty adjust body:

```json
{
  "points": 50,
  "type": "earned",
  "reason": "Support goodwill credit"
}
```

### Wallet Config

- `GET {{gatewayUrl}}/api/admin/auth/wallet/config`
- `PUT {{gatewayUrl}}/api/admin/auth/wallet/config`
- `GET {{gatewayUrl}}/api/admin/auth/wallet/rewards`
- `POST {{gatewayUrl}}/api/admin/auth/wallet/rewards`
- `PUT {{gatewayUrl}}/api/admin/auth/wallet/rewards/{{rewardRuleId}}`
- `DELETE {{gatewayUrl}}/api/admin/auth/wallet/rewards/{{rewardRuleId}}`

Config body:

```json
{
  "minAddAmount": 100,
  "maxAddAmount": 10000,
  "bonusEnabled": true
}
```

Reward rule body:

```json
{
  "ruleType": "wallet_recharge",
  "rewardMode": "percentage",
  "rewardValue": 10,
  "minRechargeValue": 500,
  "maxRewardAmount": 100,
  "targetCityCodes": ["BLR"],
  "firstOrderOnly": false,
  "expiryDays": 30,
  "priorityRank": 1,
  "isActive": true
}
```

### Referral Campaigns

- `GET {{gatewayUrl}}/api/admin/auth/referrals/campaigns`
- `POST {{gatewayUrl}}/api/admin/auth/referrals/campaigns`
- `PUT {{gatewayUrl}}/api/admin/auth/referrals/campaigns/{{campaignId}}`
- `DELETE {{gatewayUrl}}/api/admin/auth/referrals/campaigns/{{campaignId}}`

Body:

```json
{
  "title": "Refer and Earn May",
  "bannerTitle": "Invite friends",
  "bannerSubtitle": "Earn wallet cash",
  "referrerRewardAmount": 100,
  "refereeRewardAmount": 75,
  "firstOrderRequired": true,
  "minimumCartValue": 399,
  "targetCityCodes": ["BLR"],
  "rewardExpiryDays": 30,
  "isActive": true
}
```

### Vendors

- `GET {{gatewayUrl}}/api/admin/auth/vendors`
- `GET {{gatewayUrl}}/api/admin/auth/vendors/pending`
- `GET {{gatewayUrl}}/api/admin/auth/vendors/{{vendorId}}`
- `PUT {{gatewayUrl}}/api/admin/auth/vendors/{{vendorId}}`
- `PATCH {{gatewayUrl}}/api/admin/auth/vendors/{{vendorId}}/approve`
- `PATCH {{gatewayUrl}}/api/admin/auth/vendors/{{vendorId}}/suspend`
- `GET {{gatewayUrl}}/api/admin/auth/vendors/{{vendorId}}/payouts`

Approve body:

```json
{
  "isApproved": true
}
```

Suspend body:

```json
{
  "suspended": true
}
```

### Settlements

- `GET {{gatewayUrl}}/api/admin/auth/settlements`
- `GET {{gatewayUrl}}/api/admin/auth/settlements?status=pending&vendorId={{vendorId}}`
- `GET {{gatewayUrl}}/api/admin/auth/settlements/stats`
- `POST {{gatewayUrl}}/api/admin/auth/settlements`
- `PATCH {{gatewayUrl}}/api/admin/auth/settlements/{{settlementId}}`
- `PATCH {{gatewayUrl}}/api/admin/auth/settlements/{{settlementId}}/paid`

Create body:

```json
{
  "vendorId": "vendor-user-uuid",
  "amount": 5000,
  "grossAmount": 6200,
  "commissionAmount": 1200,
  "orderCount": 14,
  "note": "Weekly payout"
}
```

Typical response:

```json
{
  "id": "settlement-uuid",
  "vendorId": "vendor-user-uuid",
  "amount": 5000,
  "status": "pending"
}
```

---

## 5. Direct Auth Service APIs

These do not go through the gateway.

### Vendor Dashboard

- `GET {{authServiceUrl}}/vendor/dashboard/stats?vendorId={{vendorId}}`
- `GET {{authServiceUrl}}/vendor/earnings?vendorId={{vendorId}}`
- `GET {{authServiceUrl}}/vendor/earnings?vendorId={{vendorId}}&startDate=2026-05-01&endDate=2026-05-31&status=paid`
- `GET {{authServiceUrl}}/vendor/schedule?vendorId={{vendorId}}`
- `PUT {{authServiceUrl}}/vendor/schedule`
- `PUT {{authServiceUrl}}/vendor/services`
- `PUT {{authServiceUrl}}/vendor/capacity`

Update schedule body:

```json
{
  "outletId": "outlet-uuid",
  "operatingHours": "10:00-20:00"
}
```

Update services body:

```json
{
  "vendorId": "vendor-user-uuid",
  "servicesOffered": "Dry Clean, Steam Iron"
}
```

Update capacity body:

```json
{
  "vendorId": "vendor-user-uuid",
  "dailyCapacity": 140
}
```

### Support Tickets

- `POST {{authServiceUrl}}/tickets`
- `GET {{authServiceUrl}}/tickets/my-tickets?userId={{userId}}`
- `GET {{authServiceUrl}}/tickets/my-tickets?userId={{vendorId}}&role=vendor`
- `GET {{authServiceUrl}}/tickets/admin/all`
- `PATCH {{authServiceUrl}}/tickets/{{ticketId}}/status`

Create ticket body:

```json
{
  "userId": "user-uuid",
  "targetId": "vendor-user-uuid",
  "subject": "Clothes delayed",
  "category": "delivery",
  "message": "Pickup happened but delivery is delayed.",
  "priority": "high"
}
```

Response:

```json
{
  "id": "ticket-uuid",
  "userId": "user-uuid",
  "targetId": "vendor-user-uuid",
  "subject": "Clothes delayed",
  "status": "open"
}
```

Update status body:

```json
{
  "status": "resolved",
  "isEscalated": false
}
```

### Addresses

- `GET {{authServiceUrl}}/addresses/{{userId}}`
- `POST {{authServiceUrl}}/addresses/{{userId}}`
- `PUT {{authServiceUrl}}/addresses/{{addressId}}`
- `DELETE {{authServiceUrl}}/addresses/{{addressId}}`

Create body:

```json
{
  "flat": "Flat 203",
  "street": "MG Road",
  "landmark": "Near Metro",
  "city": "Bengaluru",
  "zipCode": "560001",
  "lat": 12.9716,
  "lng": 77.5946,
  "type": "home"
}
```

Response:

```json
{
  "message": "Address created",
  "address": {
    "id": "address-uuid",
    "userId": "user-uuid",
    "addressLine": "Flat 203, MG Road, Near Metro, Bengaluru, 560001"
  }
}
```

### Payment Methods

- `GET {{authServiceUrl}}/payment-methods/{{userId}}`
- `POST {{authServiceUrl}}/payment-methods`
- `PUT {{authServiceUrl}}/payment-methods/{{paymentMethodId}}`
- `DELETE {{authServiceUrl}}/payment-methods/{{paymentMethodId}}`
- `POST {{authServiceUrl}}/payment-methods/{{paymentMethodId}}/default`

Create card body:

```json
{
  "userId": "user-uuid",
  "type": "card",
  "cardType": "visa",
  "lastFour": "4242",
  "cardHolderName": "Test Customer",
  "expiryMonth": "12",
  "expiryYear": "2029",
  "isDefault": true
}
```

Create UPI body:

```json
{
  "userId": "user-uuid",
  "type": "upi",
  "upiId": "customer@upi",
  "isDefault": false
}
```

Response:

```json
{
  "id": "payment-method-uuid",
  "userId": "user-uuid",
  "type": "card",
  "isDefault": true
}
```

---

## 6. Catalog APIs

### Public Catalog

- `GET {{gatewayUrl}}/api/catalog/services`
- `GET {{gatewayUrl}}/api/catalog/input-data`

Response shape:

```json
[
  {
    "id": "service-uuid",
    "name": "Dry Clean",
    "categories": [
      {
        "id": "category-uuid",
        "name": "Men",
        "subCategories": [
          {
            "id": "subcategory-uuid",
            "name": "Topwear",
            "items": [
              {
                "id": "item-uuid",
                "name": "Shirt",
                "customerPrice": 89
              }
            ]
          }
        ]
      }
    ]
  }
]
```

### Bulk Item Lookup

- `POST {{gatewayUrl}}/api/catalog/items/bulk`

Body:

```json
{
  "itemIds": ["item-uuid-1", "item-uuid-2"],
  "cityCode": "BLR",
  "vendorId": "vendor-user-uuid"
}
```

Response:

```json
[
  {
    "id": "item-uuid-1",
    "name": "Shirt",
    "customerPrice": 89,
    "vendorShare": 60,
    "gstPercent": 18,
    "isOverridden": false,
    "overrideId": null
  }
]
```

### Pricing Resolve

- `POST {{gatewayUrl}}/api/catalog/pricing/resolve`

Body:

```json
{
  "cityCode": "BLR",
  "vendorId": "vendor-user-uuid",
  "serviceMultiplier": 1.5,
  "items": [
    {
      "itemId": "item-uuid-1",
      "quantity": 2
    }
  ]
}
```

Response:

```json
{
  "lineItems": [
    {
      "itemId": "item-uuid-1",
      "itemName": "Shirt",
      "quantity": 2,
      "unitPrice": 89,
      "lineSubtotal": 267,
      "lineTotal": 315.06,
      "gstPercent": 18
    }
  ],
  "subtotalAmount": 267,
  "gstAmount": 48.06,
  "vendorShareAmount": 180,
  "platformCommissionAmount": 87,
  "totalAmount": 315.06
}
```

### Home Content

- `GET {{gatewayUrl}}/api/catalog/home-config`
- `GET {{gatewayUrl}}/api/catalog/home-config?cityCode=BLR&userSegment=new_users`

Response:

```json
{
  "banners": [],
  "videos": [],
  "campaigns": [],
  "cityCode": "BLR"
}
```

### Locations

- `GET {{gatewayUrl}}/api/catalog/locations/cities`
- `GET {{gatewayUrl}}/api/catalog/locations/time-slots`
- `GET {{gatewayUrl}}/api/catalog/locations/time-slots?cityCode=BLR&slotType=pickup`
- `POST {{gatewayUrl}}/api/catalog/locations/validate`

Validate body:

```json
{
  "cityCode": "BLR",
  "areaCode": "IND-BLR-CENTRAL",
  "pickupTime": "2026-05-01T10:00:00.000Z",
  "slotId": "slot-uuid"
}
```

Response:

```json
{
  "valid": true,
  "slotValid": true,
  "serviceAvailable": true,
  "cityCode": "BLR",
  "areaCode": "IND-BLR-CENTRAL",
  "surgePercent": 0,
  "resolvedSlaHours": 72,
  "slotType": "pickup"
}
```

---

## 7. Admin Catalog APIs

All routes below require `Authorization: Bearer {{adminToken}}`.

### Services

- `GET {{gatewayUrl}}/api/admin/catalog/services`
- `POST {{gatewayUrl}}/api/admin/catalog/services`
- `PUT {{gatewayUrl}}/api/admin/catalog/services/{{serviceId}}`
- `PATCH {{gatewayUrl}}/api/admin/catalog/services/{{serviceId}}/status`
- `DELETE {{gatewayUrl}}/api/admin/catalog/services/{{serviceId}}`

Create body:

```json
{
  "name": "Dry Clean",
  "slug": "dry-clean",
  "description": "Premium dry cleaning",
  "icon": "shirt",
  "color": "#14532d",
  "displayOrder": 1,
  "isActive": true,
  "defaultProcessingHours": 72,
  "expressOptionAllowed": true,
  "surgePricingAllowed": true,
  "defaultCommissionPercent": 18,
  "targetCityCodes": ["BLR"]
}
```

### Categories

- `GET {{gatewayUrl}}/api/admin/catalog/categories`
- `GET {{gatewayUrl}}/api/admin/catalog/categories?serviceId={{serviceId}}`
- `POST {{gatewayUrl}}/api/admin/catalog/categories`
- `PUT {{gatewayUrl}}/api/admin/catalog/categories/{{categoryId}}`
- `PATCH {{gatewayUrl}}/api/admin/catalog/categories/{{categoryId}}/status`
- `DELETE {{gatewayUrl}}/api/admin/catalog/categories/{{categoryId}}`
- `PATCH {{gatewayUrl}}/api/admin/catalog/categories/reorder`

Create body:

```json
{
  "serviceId": "service-uuid",
  "name": "Men",
  "icon": "user",
  "displayOrder": 1,
  "isActive": true
}
```

Reorder body:

```json
{
  "categories": [
    { "id": "category-1", "displayOrder": 1 },
    { "id": "category-2", "displayOrder": 2 }
  ]
}
```

### Subcategories

- `GET {{gatewayUrl}}/api/admin/catalog/subcategories`
- `GET {{gatewayUrl}}/api/admin/catalog/subcategories?categoryId={{categoryId}}`
- `POST {{gatewayUrl}}/api/admin/catalog/subcategories`
- `PUT {{gatewayUrl}}/api/admin/catalog/subcategories/{{subCategoryId}}`
- `PATCH {{gatewayUrl}}/api/admin/catalog/subcategories/{{subCategoryId}}/status`
- `DELETE {{gatewayUrl}}/api/admin/catalog/subcategories/{{subCategoryId}}`

Create body:

```json
{
  "categoryId": "category-uuid",
  "name": "Topwear",
  "displayOrder": 1,
  "isActive": true
}
```

### Items

- `GET {{gatewayUrl}}/api/admin/catalog/items`
- `GET {{gatewayUrl}}/api/admin/catalog/items?subCategoryId={{subCategoryId}}`
- `POST {{gatewayUrl}}/api/admin/catalog/items`
- `PUT {{gatewayUrl}}/api/admin/catalog/items/{{itemId}}`
- `PATCH {{gatewayUrl}}/api/admin/catalog/items/{{itemId}}/status`
- `DELETE {{gatewayUrl}}/api/admin/catalog/items/{{itemId}}`

Create body:

```json
{
  "subCategoryId": "subcategory-uuid",
  "name": "Shirt",
  "skuCode": "MEN-SHIRT-001",
  "customerPrice": 89,
  "vendorShare": 60,
  "gstPercent": 18,
  "imageUrl": "https://example.com/shirt.png",
  "isActive": true
}
```

Typical response:

```json
{
  "id": "item-uuid",
  "subCategoryId": "subcategory-uuid",
  "name": "Shirt",
  "customerPrice": 89,
  "vendorShare": 60,
  "gstPercent": 18
}
```

### Bulk Item Operations

- `POST {{gatewayUrl}}/api/admin/catalog/items/bulk-upload`
- `POST {{gatewayUrl}}/api/admin/catalog/items/bulk-price-update`
- `POST {{gatewayUrl}}/api/admin/catalog/items/price-preview`
- `GET {{gatewayUrl}}/api/admin/catalog/items/price-overrides`
- `POST {{gatewayUrl}}/api/admin/catalog/items/price-overrides`

Bulk upload body:

```json
{
  "items": [
    {
      "subCategoryId": "subcategory-uuid",
      "name": "Trousers",
      "customerPrice": 119,
      "vendorShare": 80,
      "gstPercent": 18
    }
  ]
}
```

Bulk price update body:

```json
{
  "updates": [
    {
      "id": "item-uuid",
      "customerPrice": 99,
      "vendorShare": 70,
      "gstPercent": 18,
      "isActive": true
    }
  ]
}
```

Price preview body:

```json
{
  "items": [
    {
      "customerPrice": 100,
      "vendorShare": 70,
      "gstPercent": 18
    }
  ]
}
```

Price override save body:

```json
{
  "overrides": [
    {
      "itemId": "item-uuid",
      "cityCode": "BLR",
      "vendorId": null,
      "customerPrice": 95,
      "vendorShare": 65,
      "gstPercent": 18,
      "isActive": true
    }
  ]
}
```

### Content Admin

- `GET {{gatewayUrl}}/api/admin/catalog/content/banners`
- `POST {{gatewayUrl}}/api/admin/catalog/content/banners`
- `PUT {{gatewayUrl}}/api/admin/catalog/content/banners/{{bannerId}}`
- `DELETE {{gatewayUrl}}/api/admin/catalog/content/banners/{{bannerId}}`
- `GET {{gatewayUrl}}/api/admin/catalog/content/videos`
- `POST {{gatewayUrl}}/api/admin/catalog/content/videos`
- `PUT {{gatewayUrl}}/api/admin/catalog/content/videos/{{videoId}}`
- `DELETE {{gatewayUrl}}/api/admin/catalog/content/videos/{{videoId}}`
- `GET {{gatewayUrl}}/api/admin/catalog/content/campaigns`
- `POST {{gatewayUrl}}/api/admin/catalog/content/campaigns`
- `PUT {{gatewayUrl}}/api/admin/catalog/content/campaigns/{{campaignId}}`
- `DELETE {{gatewayUrl}}/api/admin/catalog/content/campaigns/{{campaignId}}`

Banner body:

```json
{
  "title": "Free Pickup",
  "subtitle": "Orders above 499",
  "ctaLabel": "Book now",
  "ctaType": "service",
  "ctaTargetId": "service-uuid",
  "imageUrl": "https://example.com/banner.jpg",
  "isActive": true,
  "priorityRank": 1,
  "targetCityCodes": ["BLR"],
  "targetUserSegments": ["new_users"]
}
```

Video body:

```json
{
  "title": "How CleClo Works",
  "description": "Pickup to delivery flow",
  "videoUrl": "https://example.com/video.mp4",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "durationSeconds": 45,
  "sortOrder": 1,
  "isActive": true
}
```

Campaign body:

```json
{
  "title": "Summer Offer",
  "code": "SUMMER20",
  "description": "20 percent off",
  "campaignType": "coupon",
  "discountType": "percentage",
  "discountValue": 20,
  "minCartValue": 399,
  "firstOrderOnly": false,
  "targetCityCodes": ["BLR"],
  "isActive": true
}
```

### Location Admin

- `GET {{gatewayUrl}}/api/admin/catalog/location/states`
- `GET {{gatewayUrl}}/api/admin/catalog/location/states/KA/cities`
- `GET {{gatewayUrl}}/api/admin/catalog/location/cities`
- `POST {{gatewayUrl}}/api/admin/catalog/location/cities`
- `PUT {{gatewayUrl}}/api/admin/catalog/location/cities/{{cityId}}`
- `DELETE {{gatewayUrl}}/api/admin/catalog/location/cities/{{cityId}}`
- `GET {{gatewayUrl}}/api/admin/catalog/location/areas`
- `POST {{gatewayUrl}}/api/admin/catalog/location/areas`
- `PUT {{gatewayUrl}}/api/admin/catalog/location/areas/{{areaId}}`
- `DELETE {{gatewayUrl}}/api/admin/catalog/location/areas/{{areaId}}`
- `GET {{gatewayUrl}}/api/admin/catalog/location/time-slots`
- `POST {{gatewayUrl}}/api/admin/catalog/location/time-slots`
- `PUT {{gatewayUrl}}/api/admin/catalog/location/time-slots/{{timeSlotId}}`
- `DELETE {{gatewayUrl}}/api/admin/catalog/location/time-slots/{{timeSlotId}}`

Create city body:

```json
{
  "cityCode": "BLR",
  "cityName": "Bengaluru",
  "stateCode": "KA",
  "stateName": "Karnataka",
  "isEnabled": true,
  "displayOrder": 1,
  "timezone": "Asia/Kolkata"
}
```

Create area body:

```json
{
  "cityCode": "BLR",
  "areaCode": "IND-BLR-CENTRAL",
  "areaName": "Central Bengaluru",
  "isEnabled": true,
  "surgePercent": 10
}
```

Create time slot body:

```json
{
  "cityCode": "BLR",
  "slotType": "pickup",
  "dayOfWeek": 5,
  "startTime": "09:00",
  "endTime": "11:00",
  "capacityLimit": 50,
  "isActive": true
}
```

---

## 8. Order APIs

### Check Price

- `POST {{gatewayUrl}}/api/orders/price-check`

Body:

```json
{
  "pickupTime": "2026-05-01T10:00:00.000Z",
  "serviceType": "Express 24h"
}
```

Response:

```json
{
  "deliveryDate": "2026-05-02T10:00:00.000Z",
  "multiplier": 2
}
```

### Upload Image

- `POST {{gatewayUrl}}/api/orders/upload`
- Form-data field: `image`

Response:

```json
{
  "imageUrl": "/uploads/1714550000000.jpg"
}
```

### Create Order

- `POST {{gatewayUrl}}/api/orders`

Body:

```json
{
  "userId": "user-uuid",
  "vendorId": "vendor-user-uuid",
  "pickupTime": "2026-05-02T10:00:00.000Z",
  "serviceType": "Standard",
  "gstNumber": "29ABCDE1234F1Z5",
  "pickupAddress": "12 MG Road, Bengaluru",
  "deliveryAddress": "12 MG Road, Bengaluru",
  "cityCode": "BLR",
  "areaCode": "IND-BLR-CENTRAL",
  "areaName": "Central Bengaluru",
  "slotId": "slot-uuid",
  "items": [
    {
      "itemId": "item-uuid-1",
      "quantity": 2,
      "condition": "stain on collar",
      "images": ["/uploads/1714550000000.jpg"]
    }
  ]
}
```

Response:

```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "vendorId": "vendor-user-uuid",
  "status": "pending",
  "totalAmount": 315.06,
  "subtotalAmount": 267,
  "gstAmount": 48.06,
  "locationSurcharge": 0,
  "cityCode": "BLR",
  "slotId": "slot-uuid",
  "items": [
    {
      "id": "order-item-uuid",
      "itemId": "item-uuid-1",
      "quantity": 2,
      "unitPrice": 89
    }
  ]
}
```

### Customer Orders

- `GET {{gatewayUrl}}/api/orders/customer/{{userId}}`
- `GET {{gatewayUrl}}/api/orders/{{orderId}}`
- `PATCH {{gatewayUrl}}/api/orders/{{orderId}}/status`

Status update body:

```json
{
  "status": "cancelled"
}
```

---

## 9. Admin Order APIs

All routes below require `Authorization: Bearer {{adminToken}}`.

### Dashboard and Analytics

- `GET {{gatewayUrl}}/api/admin/orders/dashboard/stats`
- `GET {{gatewayUrl}}/api/admin/orders/analytics`

Stats response:

```json
{
  "totalOrders": 100,
  "todayOrders": 8,
  "pendingOrders": 10,
  "processingOrders": 14,
  "deliveredOrders": 60,
  "issueOrders": 3,
  "revenue": 45000
}
```

### Orders

- `GET {{gatewayUrl}}/api/admin/orders`
- `GET {{gatewayUrl}}/api/admin/orders?status=pending&vendorId={{vendorId}}&page=1&limit=10`
- `GET {{gatewayUrl}}/api/admin/orders?search=blr`
- `GET {{gatewayUrl}}/api/admin/orders/issues`
- `GET {{gatewayUrl}}/api/admin/orders/{{orderId}}`
- `PATCH {{gatewayUrl}}/api/admin/orders/{{orderId}}/status`

Status body:

```json
{
  "status": "processing"
}
```

List response:

```json
{
  "orders": [
    {
      "id": "order-uuid",
      "status": "pending",
      "userId": "user-uuid",
      "vendorId": "vendor-user-uuid"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### Assignment

- `PATCH {{gatewayUrl}}/api/admin/orders/{{orderId}}/assign-vendor`
- `PATCH {{gatewayUrl}}/api/admin/orders/{{orderId}}/assign-rider`

Assign vendor body:

```json
{
  "vendorId": "vendor-user-uuid"
}
```

Assign rider body:

```json
{
  "riderId": "rider-user-uuid"
}
```

Response:

```json
{
  "message": "Vendor assigned",
  "order": {
    "id": "order-uuid",
    "status": "pickup_assigned"
  }
}
```

### Issues

- `POST {{gatewayUrl}}/api/admin/orders/{{orderId}}/issue`
- `PATCH {{gatewayUrl}}/api/admin/orders/{{orderId}}/resolve-issue`

Issue body:

```json
{
  "issueType": "damage",
  "issueNote": "Button broken during inspection"
}
```

Response:

```json
{
  "message": "Issue reported",
  "order": {
    "id": "order-uuid",
    "hasIssue": true,
    "issueType": "damage"
  }
}
```

---

## 10. Direct Order Service Vendor APIs

These do not go through the gateway.

### Vendor Order Routes

- `GET {{orderServiceUrl}}/vendor/orders?vendorId={{vendorId}}`
- `GET {{orderServiceUrl}}/vendor/orders?vendorId={{vendorId}}&status=pending`
- `GET {{orderServiceUrl}}/vendor/orders/stats?vendorId={{vendorId}}`
- `PATCH {{orderServiceUrl}}/vendor/orders/{{orderId}}/status`
- `PATCH {{orderServiceUrl}}/vendor/orders/{{orderId}}/accept`
- `PATCH {{orderServiceUrl}}/vendor/orders/{{orderId}}/ready`

Update status body:

```json
{
  "status": "processing"
}
```

Accept response:

```json
{
  "message": "Order accepted",
  "order": {
    "id": "order-uuid",
    "status": "picked_up"
  }
}
```

Ready response:

```json
{
  "message": "Order marked ready for delivery",
  "order": {
    "id": "order-uuid",
    "status": "out_for_delivery"
  }
}
```

### Internal Orders API

- `GET {{orderServiceUrl}}/internal/orders`
- `GET {{orderServiceUrl}}/internal/orders?userIds={{userId}},{{vendorId}}`

Response:

```json
[
  {
    "id": "order-uuid",
    "userId": "user-uuid",
    "vendorId": "vendor-user-uuid",
    "items": []
  }
]
```

---

## 11. Common Error Responses

### Validation Error

```json
{
  "message": "items must be an array"
}
```

### Missing Required Field

```json
{
  "error": "userId is required"
}
```

### Unauthorized Admin Request

```json
{
  "message": "Authentication required."
}
```

### Invalid Admin Token

```json
{
  "message": "Invalid or expired token."
}
```

### Generic Server Error

```json
{
  "message": "Internal Server Error"
}
```

---

## 12. Recommended Test Order

1. Create customer
2. Login customer
3. Create vendor
4. Admin login and verify OTP
5. Create city, area, time slot
6. Create service, category, subcategory, item
7. Resolve pricing
8. Upload image
9. Create order
10. Assign vendor
11. Vendor accepts and updates order
12. Test support ticket, wallet, and settlement flows

## 13. Known Current Gaps

- Gateway does not proxy `/vendor`, `/tickets`, `/addresses`, `/payment-methods`, or `/vendor/orders`
- Most customer/vendor routes currently trust IDs from request data instead of auth middleware
- `/api/auth/admin/login` and `/api/auth/admin/verify-otp` are the practical gateway paths for admin OTP login
- Admin auth routes under the gateway become `/api/admin/auth/...`

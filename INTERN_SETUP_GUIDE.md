# CleClo Backend Setup Guide for Interns

Welcome! This guide will help you set up the CleClo backend on your machine and populate the databases with test data.

## 📋 Prerequisites

Before starting, make sure you have these installed on your computer:

### 1. **Node.js** (v18 or higher)

- Download from: https://nodejs.org/
- Check installation: Open terminal and run `node --version`

### 2. **PostgreSQL** (v14 or higher)

- **Windows**: Download from https://www.postgresql.org/download/windows/
- **Mac**: Use Homebrew: `brew install postgresql`
- During installation, remember the password you set for the `postgres` user
- Check installation: Run `psql --version`

### 3. **Git**

- Download from: https://git-scm.com/
- Check installation: Run `git --version`

### 4. **Code Editor** (VS Code recommended)

- Download from: https://code.visualstudio.com/

---

## 🚀 Step-by-Step Setup

### Step 1: Get the Code

**Option A: If you have Git access to the repository**

```bash
# Clone the repository
git clone <repository-url>
cd Ravindra-cleclo

# Pull latest changes
git pull origin main
```

**Option B: If you received a zip file**

- Extract the zip file
- Open terminal in the extracted folder

---

### Step 2: Install Dependencies

Open terminal in the `Ravindra-cleclo/backend` folder and run:

```bash
# For Auth Service
cd services/auth-service
npm install

# For Catalog Service
cd ../catalog-service
npm install

# For Order Service
cd ../order-service
npm install
```

**Expected output**: You should see "added X packages" for each service.

---

### Step 3: Set Up PostgreSQL Databases

#### 3.1 Start PostgreSQL

**Windows:**

- Open "Services" (search in Windows menu)
- Find "postgresql-x64-XX" (where XX is version number)
- Right-click → Start

**Mac:**

```bash
brew services start postgresql
```

#### 3.2 Create Databases

Open **pgAdmin** or use terminal:

**Using Terminal:**

```bash
# Login to PostgreSQL (enter password when prompted)
psql -U postgres

# Create databases (run these one by one)
CREATE DATABASE cleclo_auth;
CREATE DATABASE cleclo_catalog;
CREATE DATABASE cleclo_orders;

# Verify databases were created
\l

# Exit
\q
```

**Using pgAdmin:**

1. Open pgAdmin
2. Right-click "Databases" → Create → Database
3. Create three databases: `cleclo_auth`, `cleclo_catalog`, `cleclo_orders`

---

### Step 4: Configure Environment Files

Each service needs a `.env` file with database connection details.

**For Windows users:** Your password is likely what you set during PostgreSQL installation (probably something like `postgres` or `admin`).

#### 4.1 Check Auth Service `.env`

Open `backend/services/auth-service/.env` and verify it looks like this:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/cleclo_auth?schema=public"
PORT=3001
JWT_SECRET="supersecret_auth_key"
```

**Replace `YOUR_PASSWORD`** with your PostgreSQL password.

#### 4.2 Check Catalog Service `.env`

Open `backend/services/catalog-service/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/cleclo_catalog?schema=public"
PORT=3002
```

#### 4.3 Check Order Service `.env`

Open `backend/services/order-service/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/cleclo_orders?schema=public"
PORT=3003
```

---

### Step 5: Run Database Migrations

Migrations create the database tables.

```bash
# Auth Service
cd backend/services/auth-service
npx prisma migrate dev

# Catalog Service
cd ../catalog-service
npx prisma migrate dev

# Order Service
cd ../order-service
npx prisma migrate dev
```

**What you should see:**

- "Your database is now in sync with your schema"
- No errors

**If you see errors:**

- Check your PostgreSQL password in `.env` files
- Make sure PostgreSQL is running
- Make sure the databases were created

---

### Step 6: Seed the Databases

Now we'll fill the databases with test data!

#### 6.1 Seed Auth Service (Users, Vendors, Riders)

```bash
cd backend/services/auth-service
node prisma/seed.js
```

**Expected Output:**

```
🌱 Seeding Auth Service database...
✅ Auth Service seeding completed!
   - Created 1 admin
   - Created 10 customers
   - Created 5 vendors
   - Created 3 riders
   - Created 5 support tickets
   - Default password for all users: password123
```

**If it fails:**

- Check PostgreSQL is running
- Check `.env` file has correct password
- Try running migrations again (Step 5)

#### 6.2 Seed Catalog Service (Items & Pricing)

```bash
cd ../catalog-service
node prisma/seed.js
```

**Expected Output:**

```
🌱 Seeding Catalog Service database...
✅ Catalog Service seeding completed!
   - Created 3 services (Dry Clean, Wash Only, Iron)
   - Created 12 categories
   - Created 90+ items across all categories
```

#### 6.3 Get Real IDs for Order Service

```bash
cd ..
node get-ids-for-orders.js
```

This will show you real user and item IDs like:

```
const customerIds = [
  'abc-123-def-456', // Ravindra Kumar
  ...
];
```

**IMPORTANT:** Copy all the IDs shown in the output.

#### 6.4 Update Order Service Seed File

1. Open `backend/services/order-service/prisma/seed.js` in your code editor
2. Find lines 12-30 (the placeholder IDs)
3. Replace them with the IDs you just copied
4. Save the file

#### 6.5 Seed Order Service (Sample Orders)

```bash
cd order-service
node prisma/seed.js
```

**Expected Output:**

```
🌱 Seeding Order Service database...
✅ Order Service seeding completed!
   - Created 7 orders with various statuses
```

---

## ✅ Verify Everything Works

### Option 1: Using Prisma Studio (Visual Interface)

```bash
# Auth Service
cd backend/services/auth-service
npx prisma studio
# Opens in browser at http://localhost:5555

# Check the "User" table - you should see 19 users
# Check the "Wallet" table - you should see wallets for all users
```

Repeat for catalog and order services.

### Option 2: Quick Database Check

```bash
# Connect to PostgreSQL
psql -U postgres -d cleclo_auth

# Check users count
SELECT COUNT(*) FROM "User";
# Should show 19

# Check by role
SELECT role, COUNT(*) FROM "User" GROUP BY role;
# Should show: admin(1), customer(10), vendor(5), rider(3)

# Exit
\q
```

---

## 🧪 Test the APIs

### Start the Services

Open **3 separate terminal windows**:

**Terminal 1 - Auth Service:**

```bash
cd backend/services/auth-service
npm start
```

**Terminal 2 - Catalog Service:**

```bash
cd backend/services/catalog-service
npm start
```

**Terminal 3 - Order Service:**

```bash
cd backend/services/order-service
npm start
```

### Test Login API

Open a new terminal and run:

**Windows (PowerShell):**

```powershell
$body = @{
    email = "ravindra@example.com"
    password = "password123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method Post -Body $body -ContentType "application/json"
```

**Mac/Linux:**

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ravindra@example.com","password":"password123"}'
```

**Expected Response:**

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1...",
  "user": {
    "id": "...",
    "name": "Ravindra Kumar",
    "email": "ravindra@example.com",
    "role": "customer"
  }
}
```

### Test Catalog API

**Windows:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3002/catalog/services"
```

**Mac/Linux:**

```bash
curl http://localhost:3002/catalog/services
```

**Expected Response:** JSON with 3 services, categories, and items.

---

## 📊 What Data Was Created?

### Users (19 total)

| Email                  | Password    | Role     | Type        |
| ---------------------- | ----------- | -------- | ----------- |
| admin@cleclo.com       | password123 | Admin    | -           |
| ravindra@example.com   | password123 | Customer | VIP         |
| priya@example.com      | password123 | Customer | Regular     |
| amit@example.com       | password123 | Customer | Top Spender |
| vendor1@cleclo.com     | password123 | Vendor   | Approved    |
| vendor2@cleclo.com     | password123 | Vendor   | Approved    |
| rahul.rider@cleclo.com | password123 | Rider    | -           |

...and more! Check the seed.js files for complete list.

### Catalog Items

- **3 Services:** Dry Clean, Wash Only, Iron
- **12 Categories:** Men, Women, Kids, Household (for each service)
- **90+ Items** with realistic pricing (₹8 to ₹400)

### Sample Orders

- 7 orders with different statuses (pending, processing, delivered, cancelled)
- Orders include item details, images, and assigned vendors/riders

---

## 🆘 Troubleshooting

### "psql: error: connection to server failed"

- **Fix:** PostgreSQL is not running. Start it from Services (Windows) or `brew services start postgresql` (Mac)

### "password authentication failed for user postgres"

- **Fix:** Check your PostgreSQL password and update all `.env` files

### "database cleclo_auth does not exist"

- **Fix:** Create the databases (go back to Step 3.2)

### "Cannot find module 'bcryptjs'"

- **Fix:** Run `npm install` in the auth-service folder

### Seed script shows errors about UUIDs

- **Fix:** Make sure you ran migrations first (Step 5)
- **For order service:** Make sure you updated the IDs from `get-ids-for-orders.js`

### "Port 3001 is already in use"

- **Fix:** Another service is using this port. Close it or change the PORT in `.env`

---

## 🎯 Next Steps

After setup:

1. **Read the API Documentation:** Check `backend/API_DOCUMENTATION.md`
2. **Test All APIs:** Try different endpoints with Postman or curl
3. **Start Frontend Integration:** Begin connecting Flutter app to these APIs

---

## 📞 Need Help?

If you're stuck:

1. Check the error message carefully
2. Google the error (most are common setup issues)
3. Ask your mentor - send them:
   - The exact error message
   - Which step you're on
   - Screenshots if helpful

---

## 🎉 Success Checklist

- [ ] PostgreSQL installed and running
- [ ] All three databases created (cleclo_auth, cleclo_catalog, cleclo_orders)
- [ ] Dependencies installed (`npm install` completed)
- [ ] `.env` files configured with correct password
- [ ] Migrations completed (no errors)
- [ ] Auth service seeded (19 users created)
- [ ] Catalog service seeded (90+ items created)
- [ ] IDs copied from `get-ids-for-orders.js`
- [ ] Order service seed file updated with real IDs
- [ ] Order service seeded (7 orders created)
- [ ] APIs tested and responding correctly

**If all checked ✅ - You're ready to start developing!** 🚀

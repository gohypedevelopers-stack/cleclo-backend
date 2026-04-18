const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const signup = async (req, res) => {
    try {
        const { name, email, phone, password, address, lat, lng } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { phone }]
            }
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                addresses: {
                    create: {
                        addressLine: address || 'Default Address',
                        lat: parseFloat(lat) || 0,
                        lng: parseFloat(lng) || 0
                    }
                }
            }
        });

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ message: 'User created successfully', token, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ message: 'Login successful', token, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const sendOtp = async (req, res) => {
    const { phone } = req.body;
    console.log(`[MOCK] Sending OTP 1234 to ${phone}`);
    res.json({ message: 'OTP sent successfully (Mock: 1234)' });
};

const verifyOtp = async (req, res) => {
    // Mock OTP verification
    const { phone, otp } = req.body;
    if (otp === '1234') {
        res.json({ message: 'OTP Verified' });
    } else {
        res.status(400).json({ message: 'Invalid OTP' });
    }
};

const registerVendor = async (req, res) => {
    try {
        const {
            // User Basic
            name, email, phone, password,
            // Vendor Specific
            businessName, gstRegistered, gstNumber, businessType, servicesOffered,
            // Outlet
            outletName, outletAddress, lat, lng, operatingHours,
            // Capacity & Bank
            dailyCapacity, bankHolderName, bankName, accountNumber, ifscCode,
            // Terms
            termsAccepted, slaAccepted
        } = req.body;

        // 1. Check existing
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { phone }] }
        });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. Transaction to create all
        const result = await prisma.$transaction(async (prisma) => {
            // Create User
            const user = await prisma.user.create({
                data: {
                    name, email, phone, password: hashedPassword, role: 'vendor', isVerified: true // Assuming OTP verified on frontend before this call or handled via verify-otp flow
                }
            });

            // Create Vendor Profile
            await prisma.vendorProfile.create({
                data: {
                    userId: user.id,
                    businessName,
                    gstRegistered,
                    gstNumber,
                    businessType,
                    servicesOffered,
                    dailyCapacity: parseInt(dailyCapacity) || 0,
                    bankHolderName,
                    bankName,
                    accountNumber,
                    ifscCode,
                    termsAccepted,
                    slaAccepted
                }
            });

            // Create Outlet
            await prisma.outlet.create({
                data: {
                    vendorId: user.id,
                    name: outletName,
                    address: outletAddress,
                    lat: parseFloat(lat) || 0,
                    lng: parseFloat(lng) || 0,
                    operatingHours
                }
            });

            return user;
        });

        res.status(201).json({ message: 'Vendor registered successfully', userId: result.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, phone } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: { name, email, phone }
        });

        res.json({ message: 'Profile updated successfully', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    signup,
    login,
    sendOtp,
    verifyOtp,
    registerVendor,
    updateProfile
};

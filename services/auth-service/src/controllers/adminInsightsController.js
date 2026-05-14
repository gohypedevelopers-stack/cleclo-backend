const {
    getDashboardOverview,
    getIssues,
    markAllIssuesReviewed,
    updateIssue
} = require('../data/adminDashboardData');
const prisma = require('../utils/prisma');
const { fetchAllAdminOrders } = require('../utils/orderServiceClient');

const ISSUE_ACTIONS = new Set(['assign', 'review', 'escalate', 'resolve']);
const ROOT_CAUSES = new Set(['Vendor Fault', 'Rider Fault', 'Customer Fault', 'System Issue']);
const TEAM_MEMBERS = new Set([
    'Operations Head',
    'Operations Team',
    'Claims Desk',
    'Customer Success',
    'Dispatch Team',
    'Finance Ops',
    'Platform Reliability',
    'Super Admin'
]);
const REFUND_STATUSES = new Set(['Not Initiated', 'Processing', 'Completed']);
const ESCALATION_TARGETS = new Set(['Operations Head', 'Super Admin']);
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function isValidDate(value) {
    return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function validateDateRange(startDate, endDate) {
    if (!startDate && !endDate) return null;
    if (!startDate || !endDate) {
        return 'Custom date range requires both startDate and endDate.';
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return 'Custom date range must use valid ISO dates.';
    }
    if (new Date(startDate) > new Date(endDate)) {
        return 'Custom date range endDate cannot be earlier than startDate.';
    }
    return null;
}

function validateClaimFile(filePayload, fieldName) {
    if (!filePayload) return null;
    if (typeof filePayload !== 'object' || Array.isArray(filePayload)) {
        return `${fieldName} must be an object payload.`;
    }

    const { name, type, data } = filePayload;
    if (!name || !type || !data) {
        return `${fieldName} must include name, type and data.`;
    }
    if (!ALLOWED_IMAGE_TYPES.has(type)) {
        return `${fieldName} only supports JPG, PNG and WEBP images.`;
    }
    if (!String(data).startsWith(`data:${type};base64,`)) {
        return `${fieldName} must be a valid base64 data URL.`;
    }

    try {
        const rawPayload = String(data).split(',')[1] || '';
        const fileBuffer = Buffer.from(rawPayload, 'base64');
        if (!fileBuffer.length) {
            return `${fieldName} cannot be empty.`;
        }
        if (fileBuffer.length > MAX_IMAGE_BYTES) {
            return `${fieldName} exceeds the 5 MB limit.`;
        }
    } catch {
        return `${fieldName} contains invalid base64 data.`;
    }

    return null;
}

function validateDamageClaimPayload(damageClaim) {
    if (damageClaim == null) return null;
    if (typeof damageClaim !== 'object' || Array.isArray(damageClaim)) {
        return 'damageClaim must be an object.';
    }

    const numericFields = ['invoiceValue', 'liabilityCap'];
    for (const field of numericFields) {
        if (damageClaim[field] != null) {
            const value = Number(damageClaim[field]);
            if (!Number.isFinite(value) || value < 0) {
                return `${field} must be a non-negative number.`;
            }
        }
    }

    const damageImageError = validateClaimFile(damageClaim.damageImageFile, 'damageImageFile');
    if (damageImageError) return damageImageError;

    const preCleanImageError = validateClaimFile(damageClaim.preCleanImageFile, 'preCleanImageFile');
    if (preCleanImageError) return preCleanImageError;

    return null;
}

const getDashboardOverviewHandler = async (req, res) => {
    try {
        const payload = await getDashboardOverview({
            adminRole: req.admin?.adminRole,
            period: req.query.period,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            search: req.query.search,
            status: req.query.status,
            vendor: req.query.vendor,
            city: req.query.city,
            date: req.query.date
        });

        res.json(payload);
    } catch (error) {
        console.error('[DashboardOverview Error]:', error);
        res.status(500).json({ message: 'Failed to load dashboard overview', error: error.message });
    }
};

const getIssueAlertsHandler = async (req, res) => {
    try {
        const dateRangeError = validateDateRange(req.query.startDate, req.query.endDate);
        if (dateRangeError) {
            return res.status(400).json({ message: dateRangeError });
        }

        const payload = await getIssues({
            search: req.query.search,
            city: req.query.city,
            vendor: req.query.vendor,
            type: req.query.type,
            status: req.query.status,
            severity: req.query.severity,
            dateRange: req.query.dateRange,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            date: req.query.date,
            assignedTo: req.query.assignedTo,
            rootCause: req.query.rootCause,
            refundStatus: req.query.refundStatus
        });

        res.json(payload);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load issue alerts', error: error.message });
    }
};

const markAllIssuesReviewedHandler = async (req, res) => {
    try {
        const result = await markAllIssuesReviewed();
        res.json({ message: 'All issue alerts marked as reviewed', ...result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark issue alerts as reviewed', error: error.message });
    }
};

const updateIssueAlertHandler = async (req, res) => {
    try {
        if (req.body.action && !ISSUE_ACTIONS.has(req.body.action)) {
            return res.status(400).json({ message: 'Unsupported issue action' });
        }

        if (req.body.assignedTo && !TEAM_MEMBERS.has(req.body.assignedTo)) {
            return res.status(400).json({ message: 'Assigned team member is not supported' });
        }

        if (req.body.action === 'assign' && !req.body.assignedTo) {
            return res.status(400).json({ message: 'assignedTo is required when assigning an issue' });
        }

        if (req.body.escalatedTo && !ESCALATION_TARGETS.has(req.body.escalatedTo)) {
            return res.status(400).json({ message: 'Escalation target is not supported' });
        }

        if (req.body.rootCause && !ROOT_CAUSES.has(req.body.rootCause)) {
            return res.status(400).json({ message: 'Root cause is not supported' });
        }

        if (req.body.refundStatus && !REFUND_STATUSES.has(req.body.refundStatus)) {
            return res.status(400).json({ message: 'Refund status is not supported' });
        }

        const damageClaimError = validateDamageClaimPayload(req.body.damageClaim);
        if (damageClaimError) {
            return res.status(400).json({ message: damageClaimError });
        }

        if (req.body.action === 'resolve' && !req.body.rootCause) {
            return res.status(400).json({ message: 'Root cause is required to resolve an issue' });
        }

        const updatedIssue = await updateIssue(req.params.issueId, req.body);

        if (!updatedIssue) {
            return res.status(404).json({ message: 'Issue alert not found' });
        }

        res.json({ message: 'Issue alert updated', issue: updatedIssue });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update issue alert', error: error.message });
    }
};

// ─── Vendor Weekly Activity ───────────────────────────────────────────────────
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDateRange() {
    const today = new Date();
    const dow = today.getDay() === 0 ? 7 : today.getDay(); // Mon=1…Sun=7
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
}

const getVendorWeeklyActivityHandler = async (req, res) => {
    try {
        const { monday, sunday } = getWeekDateRange();
        const { city, vendorId, serviceType } = req.query;

        // --- 1. Fetch available filters for the UI ---
        const [vendors, profiles] = await Promise.all([
            prisma.user.findMany({
                where: { role: 'vendor', status: 'active' },
                select: { id: true, name: true }
            }),
            prisma.adminLoginEvent.findMany({
                where: { city: { not: null } },
                distinct: ['city'],
                select: { city: true }
            })
        ]);

        // --- 2. Fetch orders from order service ---
        let orders = [];
        try {
            const all = await fetchAllAdminOrders({ city, vendorId, serviceType });
            orders = Array.isArray(all) ? all : [];
        } catch (error) {
            console.error('[OrderService Fetch Error]:', error);
            orders = [];
        }

        // --- 3. Filter by week and calculate stats ---
        const weekOrders = orders.filter(o => {
            const d = new Date(o.createdAt || o.pickupTime);
            return d >= monday && d <= sunday;
        });

        // --- 4. Build Mon–Sun array with Orders and Revenue ---
        const result = WEEK_DAYS.map((day, i) => {
            const dayStart = new Date(monday);
            dayStart.setDate(monday.getDate() + i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const dayOrders = weekOrders.filter(o => {
                const d = new Date(o.createdAt || o.pickupTime);
                return d >= dayStart && d <= dayEnd;
            });

            return { 
                day, 
                orders: dayOrders.length, 
                revenue: dayOrders.reduce((sum, o) => sum + (o.totalAmount || o.amount || 0), 0)
            };
        });

        res.json({ 
            weeklyActivity: result, 
            filters: {
                vendors,
                cities: profiles.map(p => p.city),
                serviceTypes: ['Dry Clean', 'Laundry', 'Wash & Fold', 'Ironing'] // Standard types
            },
            generatedAt: new Date().toISOString() 
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load weekly orders graph data', error: error.message });
    }
};

module.exports = {
    getDashboardOverviewHandler,
    getIssueAlertsHandler,
    markAllIssuesReviewedHandler,
    updateIssueAlertHandler,
    getVendorWeeklyActivityHandler
};

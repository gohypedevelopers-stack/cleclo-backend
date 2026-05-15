const prisma = require('../utils/prisma');

const { ADMIN_ROLES } = require('../config/adminAccess');
const { fetchAllAdminOrders, resolveAdminOrderIssue } = require('../utils/orderServiceClient');
const { persistIssueClaimImage } = require('../utils/adminIssueAssetStorage');

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1
});

const ROOT_CAUSES = ['Vendor Fault', 'Rider Fault', 'Customer Fault', 'System Issue'];
const TEAM_MEMBERS = [
  'Operations Head',
  'Claims Desk',
  'Customer Success',
  'Dispatch Team',
  'Finance Ops',
  'Platform Reliability',
  'Super Admin'
];

const ISSUE_ICON_MAP = {
  'Item Damaged': 'damage',
  'Customer Complaint': 'complaint',
  'Pickup Delay': 'delay',
  'Customer No-Show': 'no_show',
  'System Issue': 'system'
};

const ISSUE_ALERT_STATUSES = {
  OPEN: 'OPEN',
  INVESTIGATING: 'INVESTIGATING',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED'
};
const ISSUE_ALERT_STATUS_LABELS = {
  [ISSUE_ALERT_STATUSES.OPEN]: 'Open',
  [ISSUE_ALERT_STATUSES.INVESTIGATING]: 'Investigating',
  [ISSUE_ALERT_STATUSES.ESCALATED]: 'Escalated',
  [ISSUE_ALERT_STATUSES.RESOLVED]: 'Resolved'
};
const ISSUE_ALERT_STATUS_BY_LABEL = Object.fromEntries(
  Object.entries(ISSUE_ALERT_STATUS_LABELS).map(([value, label]) => [label, value])
);

const ISSUE_ALERT_SEVERITIES = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};
const ISSUE_ALERT_SEVERITY_LABELS = {
  [ISSUE_ALERT_SEVERITIES.CRITICAL]: 'Critical',
  [ISSUE_ALERT_SEVERITIES.HIGH]: 'High',
  [ISSUE_ALERT_SEVERITIES.MEDIUM]: 'Medium',
  [ISSUE_ALERT_SEVERITIES.LOW]: 'Low'
};
const ISSUE_ALERT_SEVERITY_BY_LABEL = Object.fromEntries(
  Object.entries(ISSUE_ALERT_SEVERITY_LABELS).map(([value, label]) => [label, value])
);

const ISSUE_REFUND_STATUSES = {
  NOT_INITIATED: 'NOT_INITIATED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED'
};
const ISSUE_REFUND_STATUS_LABELS = {
  [ISSUE_REFUND_STATUSES.NOT_INITIATED]: 'Not Initiated',
  [ISSUE_REFUND_STATUSES.PROCESSING]: 'Processing',
  [ISSUE_REFUND_STATUSES.COMPLETED]: 'Completed'
};
const ISSUE_REFUND_STATUS_BY_LABEL = Object.fromEntries(
  Object.entries(ISSUE_REFUND_STATUS_LABELS).map(([value, label]) => [label, value])
);
const REFUND_STATUSES = Object.values(ISSUE_REFUND_STATUS_LABELS);

const SETTLEMENT_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED'
};

const ORDER_ISSUE_CONFIG = {
  damage: {
    issueType: 'Item Damaged',
    severity: 'Critical',
    autoEscalateAfterHours: 4,
    financialRiskLabel: 'Estimated Refund Risk',
    financialRiskRatio: 1,
    minimumRisk: 0
  },
  customer_no_show: {
    issueType: 'Customer No-Show',
    severity: 'Low',
    autoEscalateAfterHours: 4,
    financialRiskLabel: 'Potential Penalty',
    financialRiskRatio: 0.15,
    minimumRisk: 100
  },
  delayed: {
    issueType: 'Pickup Delay',
    severity: 'Medium',
    autoEscalateAfterHours: 5,
    financialRiskLabel: 'Potential Service Recovery',
    financialRiskRatio: 0.2,
    minimumRisk: 150
  },
  item_missing: {
    issueType: 'Customer Complaint',
    severity: 'High',
    autoEscalateAfterHours: 6,
    financialRiskLabel: 'Estimated Refund Risk',
    financialRiskRatio: 0.6,
    minimumRisk: 250
  },
  default: {
    issueType: 'Customer Complaint',
    severity: 'High',
    autoEscalateAfterHours: 6,
    financialRiskLabel: 'Estimated Refund Risk',
    financialRiskRatio: 0.4,
    minimumRisk: 200
  }
};

function getIssueStatusValue(value) {
  return ISSUE_ALERT_STATUS_BY_LABEL[value] || value || ISSUE_ALERT_STATUSES.OPEN;
}

function getIssueStatusLabel(value) {
  return ISSUE_ALERT_STATUS_LABELS[value] || value || 'Open';
}

function getIssueSeverityValue(value) {
  return ISSUE_ALERT_SEVERITY_BY_LABEL[value] || value || ISSUE_ALERT_SEVERITIES.MEDIUM;
}

function getIssueSeverityLabel(value) {
  return ISSUE_ALERT_SEVERITY_LABELS[value] || value || 'Medium';
}

function getRefundStatusValue(value) {
  return ISSUE_REFUND_STATUS_BY_LABEL[value] || value || ISSUE_REFUND_STATUSES.NOT_INITIATED;
}

function getRefundStatusLabel(value) {
  return ISSUE_REFUND_STATUS_LABELS[value] || value || 'Not Initiated';
}

function getSettlementStatusValue(value) {
  if (value === 'pending') return SETTLEMENT_STATUSES.PENDING;
  if (value === 'processing') return SETTLEMENT_STATUSES.PROCESSING;
  if (value === 'paid') return SETTLEMENT_STATUSES.PAID;
  if (value === 'failed') return SETTLEMENT_STATUSES.FAILED;
  return value || SETTLEMENT_STATUSES.PENDING;
}

function getSettlementStatusLabel(value) {
  const normalized = getSettlementStatusValue(value);
  if (normalized === SETTLEMENT_STATUSES.PAID) return 'Completed';
  if (normalized === SETTLEMENT_STATUSES.FAILED) return 'Failed';
  if (normalized === SETTLEMENT_STATUSES.PROCESSING) return 'Processing';
  return 'Pending';
}

function formatCurrency(value) {
  return INR_FORMATTER.format(Math.round(value || 0));
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfWeek(value) {
  const date = startOfDay(value);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getPeriodRange(period = 'today', startDate, endDate) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (period === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: yesterday, end: today };
  }

  if (period === 'this_week') {
    return { start: startOfWeek(today), end: tomorrow };
  }

  if (period === 'this_month') {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: tomorrow
    };
  }

  if (period === 'this_year') {
    return {
      start: new Date(today.getFullYear(), 0, 1),
      end: tomorrow
    };
  }

  if (period === 'custom' && startDate && endDate) {
    return {
      start: startOfDay(new Date(startDate)),
      end: endOfDay(new Date(endDate))
    };
  }

  return { start: today, end: tomorrow };
}

function getPeriodLabel(period, startDate, endDate) {
  if (period === 'yesterday') return 'Yesterday';
  if (period === 'this_week') return 'This Week';
  if (period === 'this_month') return 'This Month';
  if (period === 'this_year') return 'This Year';
  if (period === 'custom' && startDate && endDate) return `${startDate} to ${endDate}`;
  return 'Today';
}

function getPreviousPeriodRange(period, currentStart) {
  const start = new Date(currentStart);
  const end = new Date(currentStart);
  
  if (period === 'today' || period === 'yesterday') {
    start.setDate(start.getDate() - 1);
  } else if (period === 'this_week') {
    start.setDate(start.getDate() - 7);
  } else if (period === 'this_month') {
    start.setMonth(start.getMonth() - 1);
  } else if (period === 'this_year') {
    start.setFullYear(start.getFullYear() - 1);
  } else {
    return null;
  }
  return { start, end };
}

function isWithinRange(value, range) {
  if (!value) return false;
  const date = new Date(value);
  return date >= range.start && date < range.end;
}

function toIsoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function titleize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function shortId(value) {
  return String(value || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

function buildTransactionId(value, prefix) {
  return `${prefix}-${shortId(value)}`;
}

function formatDateTime(value) {
  if (!value) return 'Unavailable';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function getPickupSlot(pickupTime) {
  if (!pickupTime) return 'Unavailable';

  const start = new Date(pickupTime);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function getOrderType(serviceType) {
  return String(serviceType || '').toLowerCase().includes('express') ? 'Express' : 'Regular';
}

function getPaymentStatusLabel(status) {
  return titleize(status || 'pending');
}

function deriveCityFromAddress(addressLine) {
  if (!addressLine) return null;

  const parts = String(addressLine)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;
  return parts[parts.length - 1];
}

function getPrimaryAddress(user) {
  if (!user) return null;
  if (user.outlets && user.outlets.length > 0) return user.outlets[0].address;
  if (user.addresses && user.addresses.length > 0) return user.addresses[0].addressLine;
  return null;
}

function getVendorDisplayName(user) {
  if (!user) return 'Unassigned';
  return user.vendorProfile?.businessName || user.name || `Vendor ${shortId(user.id)}`;
}

function getCustomerDisplayName(user, fallbackId) {
  if (!user) return fallbackId ? `Customer ${shortId(fallbackId)}` : 'Customer unavailable';
  return user.name || `Customer ${shortId(user.id)}`;
}

function deriveLocation(order, customer) {
  return (
    order.pickupAddress ||
    order.deliveryAddress ||
    getPrimaryAddress(customer) ||
    'Location unavailable'
  );
}

function deriveCity(order, customer, vendor) {
  return (
    deriveCityFromAddress(order.pickupAddress) ||
    deriveCityFromAddress(order.deliveryAddress) ||
    deriveCityFromAddress(getPrimaryAddress(customer)) ||
    deriveCityFromAddress(getPrimaryAddress(vendor)) ||
    'Unknown'
  );
}

function getDeliveryEta(order, issueAlert) {
  if (order.status === 'delivered') return 'Delivered';
  if (order.status === 'cancelled') return 'Cancelled';

  if (issueAlert && getIssueStatusLabel(issueAlert.status) !== 'Resolved') {
    if (issueAlert.issueType === 'Pickup Delay') return 'Delayed';
    if (issueAlert.issueType === 'Item Damaged') return 'Damage review in progress';
    return 'Investigation in progress';
  }

  if (!order.deliveryTime) return 'Awaiting schedule';

  const deliveryTime = new Date(order.deliveryTime);
  const today = startOfDay(new Date());
  const deliveryDay = startOfDay(deliveryTime);
  const diffDays = Math.round((deliveryDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return `Today, ${formatTime(deliveryTime)}`;
  if (diffDays === 1) return `Tomorrow, ${formatTime(deliveryTime)}`;
  return formatDateTime(deliveryTime);
}

function getOrderStatusLabel(order, issueAlert) {
  if (issueAlert && getIssueStatusLabel(issueAlert.status) !== 'Resolved') {
    return issueAlert.issueType === 'Pickup Delay' ? 'Pickup Delayed' : 'Issue Reported';
  }

  const statusMap = {
    pending: 'Pending',
    pickup_assigned: 'Pending',
    picked_up: 'Processing',
    processing: 'Processing',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  };

  return statusMap[order.status] || titleize(order.status || 'pending');
}

function calculateTurnaroundHours(order) {
  if (!order.pickupTime || !order.deliveryTime) return 0;

  const diffMs = new Date(order.deliveryTime).getTime() - new Date(order.pickupTime).getTime();
  return Math.max(0, Math.round(diffMs / (60 * 60 * 1000)));
}

function calculateCommission(order, vendor) {
  if (!order.vendorId) return 0;
  const commissionRate = vendor?.vendorProfile?.commissionRate || 18;
  return Math.round((Number(order.totalAmount || 0) * commissionRate) / 100);
}

function getOrderIssueConfig(issueType) {
  return ORDER_ISSUE_CONFIG[String(issueType || '').toLowerCase()] || ORDER_ISSUE_CONFIG.default;
}

function calculateFinancialRisk(amount, config) {
  return Math.max(Math.round(Number(amount || 0) * config.financialRiskRatio), config.minimumRisk || 0);
}

function defaultAssignee(issueType) {
  if (issueType === 'Item Damaged') return 'Claims Desk';
  if (issueType === 'Pickup Delay') return 'Dispatch Team';
  if (issueType === 'System Issue') return 'Platform Reliability';
  if (issueType === 'Customer No-Show') return 'Customer Success';
  return 'Operations Head';
}

function defaultEscalationTarget(issueType) {
  return issueType === 'System Issue' ? 'Super Admin' : 'Operations Head';
}

function buildJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeDamageClaim(value) {
  const damageClaim = buildJsonObject(value);
  if (Object.keys(damageClaim).length === 0) return null;

  return {
    damageImageUploaded: Boolean(damageClaim.damageImageUploaded || damageClaim.damageImageUrl),
    preCleanImageUploaded: Boolean(damageClaim.preCleanImageUploaded || damageClaim.preCleanImageUrl),
    invoiceValue: Number(damageClaim.invoiceValue || 0),
    liabilityCap: Number(damageClaim.liabilityCap || 0),
    damageImageUrl: damageClaim.damageImageUrl || null,
    preCleanImageUrl: damageClaim.preCleanImageUrl || null,
    damageImageName: damageClaim.damageImageName || null,
    preCleanImageName: damageClaim.preCleanImageName || null
  };
}

function matchesSearch(values, search) {
  if (!search) return true;

  const normalizedSearch = String(search).trim().toLowerCase();
  if (!normalizedSearch) return true;

  return values.some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => String(left).localeCompare(String(right)));
}

function getIssueDateRange(dateRange = 'all', startDate, endDate) {
  if (startDate && endDate) {
    return getPeriodRange('custom', startDate, endDate);
  }

  if (!dateRange || dateRange === 'all') {
    return null;
  }

  return getPeriodRange(dateRange, startDate, endDate);
}

function calculateHoursOpen(createdAt, resolvedAt, status) {
  const end = getIssueStatusLabel(status) === 'Resolved' && resolvedAt ? new Date(resolvedAt) : new Date();
  const diffMs = end.getTime() - new Date(createdAt).getTime();
  return Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
}

function getSupportTicketIssueConfig(ticket) {
  const haystack = `${ticket.subject || ''} ${ticket.message || ''} ${ticket.category || ''}`.toLowerCase();

  if (haystack.includes('damage')) {
    return {
      issueType: 'Item Damaged',
      severity: 'Critical',
      autoEscalateAfterHours: 4,
      financialRiskLabel: 'Estimated Refund Risk',
      financialRiskAmount: 600
    };
  }

  if (haystack.includes('delay')) {
    return {
      issueType: 'Pickup Delay',
      severity: ticket.priority === 'high' ? 'High' : 'Medium',
      autoEscalateAfterHours: 5,
      financialRiskLabel: 'Potential Service Recovery',
      financialRiskAmount: 150
    };
  }

  if (haystack.includes('no show')) {
    return {
      issueType: 'Customer No-Show',
      severity: 'Low',
      autoEscalateAfterHours: 4,
      financialRiskLabel: 'Potential Penalty',
      financialRiskAmount: 100
    };
  }

  if (ticket.category === 'technical' || haystack.includes('system') || haystack.includes('sync')) {
    return {
      issueType: 'System Issue',
      severity: ticket.priority === 'high' ? 'High' : 'Medium',
      autoEscalateAfterHours: 4,
      financialRiskLabel: 'Potential Refund Exposure',
      financialRiskAmount: 350
    };
  }

  return {
    issueType: 'Customer Complaint',
    severity: ticket.priority === 'high' ? 'High' : ticket.priority === 'low' ? 'Low' : 'Medium',
    autoEscalateAfterHours: 6,
    financialRiskLabel: 'Estimated Refund Risk',
    financialRiskAmount: ticket.priority === 'high' ? 250 : 120
  };
}

function mapSupportTicketStatus(ticket) {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return ISSUE_ALERT_STATUSES.RESOLVED;
  if (ticket.isEscalated) return ISSUE_ALERT_STATUSES.ESCALATED;
  if (ticket.status === 'in_progress') return ISSUE_ALERT_STATUSES.INVESTIGATING;
  return ISSUE_ALERT_STATUSES.OPEN;
}

function getRoleConfiguration(adminRole) {
  if (adminRole === ADMIN_ROLES.FINANCE_ADMIN) {
    return {
      title: 'Finance Dashboard',
      subtitle: 'Track settlements, payout risk and commission movement from live platform activity.'
    };
  }

  if (adminRole === ADMIN_ROLES.OPERATIONS_ADMIN) {
    return {
      title: 'Operations Dashboard',
      subtitle: 'Monitor order flow, issue alerts, delays and activation readiness in real time.'
    };
  }

  return {
    title: 'Admin Dashboard',
    subtitle: 'Track platform revenue, operational risk, vendor performance and finance exposure from live data.'
  };
}

async function getOrders() {
  try {
    const orders = await fetchAllAdminOrders();
    return Array.isArray(orders) ? orders : [];
  } catch (error) {
    console.error('Failed to load orders from order-service:', error.message);
    return [];
  }
}

async function getBaseContext() {
  const fetchSafe = async (promise, fallback = []) => {
    try {
      return await promise;
    } catch (e) {
      console.error('[BaseContext] Query Failed:', e.message);
      return fallback;
    }
  };

  const [orders, users, settlements, supportTickets, existingAlerts] = await Promise.all([
    getOrders(),
    fetchSafe(prisma.user.findMany({
      include: {
        vendorProfile: true,
        addresses: true,
        outlets: true
      }
    })),
    fetchSafe(prisma.vendorSettlement.findMany({
      orderBy: { createdAt: 'desc' }
    })),
    fetchSafe(prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' }
    })),
    fetchSafe(prisma.adminIssueAlert.findMany({
      orderBy: { createdAt: 'desc' }
    }))
  ]);

  const userMap = new Map(users.map((user) => [user.id, user]));

  return {
    orders,
    users,
    userMap,
    settlements,
    supportTickets,
    existingAlerts
  };
}

function buildOrderIssueSeed(order, userMap) {
  if (!order.hasIssue) return null;

  const customer = userMap.get(order.userId);
  const vendor = order.vendorId ? userMap.get(order.vendorId) : null;
  const config = getOrderIssueConfig(order.issueType);
  const location = deriveLocation(order, customer);
  const city = deriveCity(order, customer, vendor);
  const hasEvidence =
    Array.isArray(order.items) &&
    order.items.some((item) => Array.isArray(item.images) && item.images.length > 0);

  return {
    keyType: 'orderId',
    keyValue: order.id,
    data: {
      orderId: order.id,
      supportTicketId: null,
      customerId: order.userId || null,
      vendorId: order.vendorId || null,
      issueType: config.issueType,
      severity: getIssueSeverityValue(config.severity),
      status: ISSUE_ALERT_STATUSES.OPEN,
      unread: true,
      city,
      description: order.issueNote || `${config.issueType} reported on order ${order.id}.`,
      summary: order.issueNote || `${config.issueType} requires admin review for ${location}.`,
      assignedTo: defaultAssignee(config.issueType),
      refundStatus:
        order.paymentStatus === 'refunded'
          ? ISSUE_REFUND_STATUSES.COMPLETED
          : ISSUE_REFUND_STATUSES.NOT_INITIATED,
      escalatedTo: null,
      autoEscalateAfterHours: config.autoEscalateAfterHours,
      financialRiskLabel: config.financialRiskLabel,
      financialRiskAmount: calculateFinancialRisk(order.totalAmount, config),
      source: 'order',
      metadata: {
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
        serviceType: order.serviceType,
        location
      },
      damageClaim:
        config.issueType === 'Item Damaged'
          ? {
              damageImageUploaded: hasEvidence,
              preCleanImageUploaded: hasEvidence,
              invoiceValue: Number(order.totalAmount || 0),
              liabilityCap: Math.round(Number(order.totalAmount || 0) * 0.5)
            }
          : null
    }
  };
}

function buildSupportIssueSeed(ticket, userMap) {
  const creator = userMap.get(ticket.userId);
  const target = ticket.targetId ? userMap.get(ticket.targetId) : null;
  const relevant =
    ticket.targetId === null || ticket.isEscalated || ['orders', 'technical'].includes(ticket.category);

  if (!relevant) return null;

  const config = getSupportTicketIssueConfig(ticket);
  const vendor = creator?.role === 'vendor' ? creator : target?.role === 'vendor' ? target : null;
  const customer = creator?.role === 'customer' ? creator : null;
  const city =
    deriveCityFromAddress(getPrimaryAddress(customer)) ||
    deriveCityFromAddress(getPrimaryAddress(vendor)) ||
    'Unknown';

  return {
    keyType: 'supportTicketId',
    keyValue: ticket.id,
    data: {
      orderId: null,
      supportTicketId: ticket.id,
      customerId: customer?.id || null,
      vendorId: vendor?.id || null,
      issueType: config.issueType,
      severity: getIssueSeverityValue(config.severity),
      status: mapSupportTicketStatus(ticket),
      unread: ticket.status !== 'resolved' && ticket.status !== 'closed',
      city,
      description: ticket.message || ticket.subject,
      summary: ticket.subject || `${config.issueType} support alert`,
      assignedTo: defaultAssignee(config.issueType),
      refundStatus: ISSUE_REFUND_STATUSES.NOT_INITIATED,
      escalatedTo: ticket.isEscalated ? defaultEscalationTarget(config.issueType) : null,
      autoEscalateAfterHours: config.autoEscalateAfterHours,
      financialRiskLabel: config.financialRiskLabel,
      financialRiskAmount: config.financialRiskAmount,
      source: 'support_ticket',
      metadata: {
        priority: ticket.priority,
        category: ticket.category,
        ticketStatus: ticket.status
      },
      damageClaim: null
    }
  };
}

function mergeSeedWithExisting(seedData, existingAlert) {
  const existingMetadata = buildJsonObject(existingAlert?.metadata);
  const nextMetadata = buildJsonObject(seedData.metadata);
  const mergedDamageClaim =
    normalizeDamageClaim(existingAlert?.damageClaim) || normalizeDamageClaim(seedData.damageClaim);

  let status = existingAlert?.status || seedData.status || ISSUE_ALERT_STATUSES.OPEN;
  if (seedData.status === ISSUE_ALERT_STATUSES.RESOLVED) status = ISSUE_ALERT_STATUSES.RESOLVED;
  if (existingAlert?.status === ISSUE_ALERT_STATUSES.RESOLVED) status = ISSUE_ALERT_STATUSES.RESOLVED;

  return {
    orderId: seedData.orderId,
    supportTicketId: seedData.supportTicketId,
    customerId: seedData.customerId,
    vendorId: seedData.vendorId,
    issueType: seedData.issueType,
    severity: seedData.severity,
    status,
    unread:
      status === ISSUE_ALERT_STATUSES.RESOLVED ? false : existingAlert ? existingAlert.unread : seedData.unread,
    city: seedData.city,
    description: seedData.description,
    summary: seedData.summary,
    assignedTo: existingAlert?.assignedTo || seedData.assignedTo || defaultAssignee(seedData.issueType),
    rootCause: existingAlert?.rootCause || null,
    refundStatus:
      existingAlert?.refundStatus || seedData.refundStatus || ISSUE_REFUND_STATUSES.NOT_INITIATED,
    escalatedTo:
      existingAlert?.escalatedTo ||
      seedData.escalatedTo ||
      (status === ISSUE_ALERT_STATUSES.ESCALATED ? defaultEscalationTarget(seedData.issueType) : null),
    autoEscalateAfterHours: seedData.autoEscalateAfterHours,
    financialRiskLabel: seedData.financialRiskLabel,
    financialRiskAmount: seedData.financialRiskAmount,
    vendorRiskLevel: existingAlert?.vendorRiskLevel || null,
    vendorRiskTrigger: existingAlert?.vendorRiskTrigger || null,
    source: seedData.source,
    metadata: { ...existingMetadata, ...nextMetadata },
    damageClaim: mergedDamageClaim,
    reviewedAt: existingAlert?.reviewedAt || null,
    resolvedAt:
      status === ISSUE_ALERT_STATUSES.RESOLVED
        ? existingAlert?.resolvedAt || new Date()
        : existingAlert?.resolvedAt || null
  };
}

async function syncIssueAlerts(context) {
  const existingByOrderId = new Map(
    context.existingAlerts.filter((alert) => alert.orderId).map((alert) => [alert.orderId, alert])
  );
  const existingByTicketId = new Map(
    context.existingAlerts
      .filter((alert) => alert.supportTicketId)
      .map((alert) => [alert.supportTicketId, alert])
  );

  const seeds = [];
  const activeOrderIds = new Set();

  context.orders.forEach((order) => {
    const seed = buildOrderIssueSeed(order, context.userMap);
    if (seed) {
      seeds.push(seed);
      activeOrderIds.add(seed.keyValue);
    }
  });

  context.supportTickets.forEach((ticket) => {
    const seed = buildSupportIssueSeed(ticket, context.userMap);
    if (seed) seeds.push(seed);
  });

  for (const seed of seeds) {
    const existingAlert =
      seed.keyType === 'orderId'
        ? existingByOrderId.get(seed.keyValue)
        : existingByTicketId.get(seed.keyValue);

    const payload = mergeSeedWithExisting(seed.data, existingAlert);
    const where = seed.keyType === 'orderId' ? { orderId: seed.keyValue } : { supportTicketId: seed.keyValue };

    await prisma.adminIssueAlert.upsert({
      where,
      update: payload,
      create: payload
    });
  }

  const staleOrderAlertIds = context.existingAlerts
    .filter((alert) => alert.source === 'order' && alert.orderId && !activeOrderIds.has(alert.orderId))
    .map((alert) => alert.id);

  if (staleOrderAlertIds.length > 0) {
    await prisma.adminIssueAlert.updateMany({
      where: {
        id: { in: staleOrderAlertIds },
        status: { not: ISSUE_ALERT_STATUSES.RESOLVED }
      },
      data: {
        status: ISSUE_ALERT_STATUSES.RESOLVED,
        unread: false,
        resolvedAt: new Date()
      }
    });
  }
}

function buildVendorRiskMap(issueAlerts) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const vendorStats = new Map();

  issueAlerts.forEach((issueAlert) => {
    if (!issueAlert.vendorId || new Date(issueAlert.createdAt) < oneWeekAgo) return;

    const current = vendorStats.get(issueAlert.vendorId) || {
      total: 0,
      damage: 0,
      noShow: 0,
      refundExposure: 0
    };

    current.total += 1;
    if (issueAlert.issueType === 'Item Damaged') current.damage += 1;
    if (issueAlert.issueType === 'Customer No-Show') current.noShow += 1;
    current.refundExposure += Number(issueAlert.financialRiskAmount || 0);

    vendorStats.set(issueAlert.vendorId, current);
  });

  const riskMap = new Map();

  vendorStats.forEach((stats, vendorId) => {
    if (stats.damage >= 5) {
      riskMap.set(vendorId, { level: 'High', trigger: '5+ damage complaints this week' });
      return;
    }

    if (stats.noShow >= 3) {
      riskMap.set(vendorId, { level: 'High', trigger: 'High no-show rate this week' });
      return;
    }

    if (stats.refundExposure >= 1000) {
      riskMap.set(vendorId, { level: 'High', trigger: 'High refund percentage this week' });
      return;
    }

    if (stats.total >= 2) {
      riskMap.set(vendorId, { level: 'Medium', trigger: 'Repeated issue volume this week' });
      return;
    }

    riskMap.set(vendorId, { level: 'Low', trigger: 'No repeated issue trend' });
  });

  return riskMap;
}

function buildOrderRows(orders, userMap, issueAlerts) {
  const issueByOrderId = new Map(
    issueAlerts.filter((alert) => alert.orderId).map((alert) => [alert.orderId, alert])
  );

  return orders.map((order) => {
    const customer = userMap.get(order.userId);
    const vendor = order.vendorId ? userMap.get(order.vendorId) : null;
    const issueAlert = issueByOrderId.get(order.id);
    const location = deriveLocation(order, customer);
    const city = deriveCity(order, customer, vendor);
    const commissionAmount = calculateCommission(order, vendor);
    const isPaid = String(order.paymentStatus).toLowerCase() === 'paid';

    return {
      id: order.id,
      customer: getCustomerDisplayName(customer, order.userId),
      vendor: vendor ? getVendorDisplayName(vendor) : 'Unassigned',
      city,
      location,
      status: getOrderStatusLabel(order, issueAlert),
      paymentStatus: getPaymentStatusLabel(order.paymentStatus),
      orderType: getOrderType(order.serviceType),
      pickupSlot: getPickupSlot(order.pickupTime),
      deliveryEta: getDeliveryEta(order, issueAlert),
      amount: Number(order.totalAmount || 0),
      transactionId: buildTransactionId(order.id, 'TXN'),
      phone: customer?.phone || 'N/A',
      customerPhone: customer?.phone || 'N/A',
      vendorPhone: vendor?.phone || 'N/A',
      issueSummary:
        issueAlert && getIssueStatusLabel(issueAlert.status) !== 'Resolved'
          ? {
              id: issueAlert.id,
              orderId: order.id,
              type: issueAlert.issueType,
              severity: getIssueSeverityLabel(issueAlert.severity),
              vendor: vendor ? getVendorDisplayName(vendor) : 'Unassigned',
              summary: issueAlert.summary,
              city
            }
          : null,
      commissionAmount,
      payoutDueAmount: isPaid && order.vendorId ? Number(order.totalAmount || 0) - commissionAmount : 0,
      turnaroundHours: calculateTurnaroundHours(order),
      createdAt: order.createdAt
    };
  });
}

function buildSettlementRows(settlements, userMap) {
  return settlements.map((settlement) => {
    const vendor = userMap.get(settlement.vendorId);
    const dueDate =
      settlement.paidAt ||
      settlement.failedAt ||
      settlement.processedAt ||
      new Date(new Date(settlement.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const status = getSettlementStatusLabel(settlement.status);

    return {
      id: settlement.id,
      vendor: vendor ? getVendorDisplayName(vendor) : `Vendor ${shortId(settlement.vendorId)}`,
      city: deriveCityFromAddress(getPrimaryAddress(vendor)) || 'Unknown',
      amount: Number(settlement.amount || 0),
      grossAmount: Number(settlement.grossAmount || settlement.amount || 0),
      commissionAmount: Number(settlement.commissionAmount || 0),
      orderCount: Number(settlement.orderCount || 0),
      periodStart: settlement.periodStart || null,
      periodEnd: settlement.periodEnd || null,
      status,
      dueDate: toIsoDate(dueDate),
      transactionId: settlement.transactionReference || buildTransactionId(settlement.id, 'SETTLE'),
      vendorPhone: vendor?.phone || 'N/A',
      failureReason:
        status === 'Failed' ? settlement.failureReason || settlement.note || 'Payout transfer failed' : null,
      note: settlement.note || null,
      processedAt: settlement.processedAt || null,
      paidAt: settlement.paidAt || null,
      failedAt: settlement.failedAt || null,
      createdAt: settlement.createdAt,
      updatedAt: settlement.updatedAt || settlement.createdAt
    };
  });
}

function getDocumentStatus(vendor) {
  const profile = vendor.vendorProfile;

  if (!profile?.ownerIdProofUrl || !profile?.businessProofUrl) return 'KYC Pending';
  if (!profile?.gstRegistered || !profile?.gstNumber) return 'GST Pending';
  return 'Documents Verified';
}

function getApprovalPriority(vendor) {
  const profile = vendor.vendorProfile;
  const documentStatus = getDocumentStatus(vendor);
  const agreementSigned = Boolean(profile?.termsAccepted && profile?.slaAccepted);

  if (!profile?.bankVerified && documentStatus === 'KYC Pending') return 'High Risk';
  if (documentStatus !== 'Documents Verified' || !agreementSigned || !profile?.bankVerified) {
    return 'Incomplete Documents';
  }
  return 'Ready to Activate';
}

function buildApprovals(vendors) {
  return vendors
    .filter((vendor) => vendor.role === 'vendor' && vendor.vendorProfile && !vendor.vendorProfile.isApproved)
    .map((vendor) => {
      const daysAgo = Math.max(
        0,
        Math.round((Date.now() - new Date(vendor.createdAt).getTime()) / (24 * 60 * 60 * 1000))
      );

      return {
        id: vendor.id,
        vendorName: getVendorDisplayName(vendor),
        city: deriveCityFromAddress(getPrimaryAddress(vendor)) || 'Unknown',
        documentStatus: getDocumentStatus(vendor),
        commissionModel: `${Math.round(vendor.vendorProfile.commissionRate || 18)}% Commission`,
        agreementSigned: Boolean(vendor.vendorProfile.termsAccepted && vendor.vendorProfile.slaAccepted),
        bankVerified: Boolean(vendor.vendorProfile.bankVerified),
        priority: getApprovalPriority(vendor),
        appliedLabel: daysAgo === 0 ? 'Applied today' : `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`
      };
    })
    .sort((left, right) => left.vendorName.localeCompare(right.vendorName));
}

function buildFinanceSnapshot(settlementRows) {
  const payoutDueAmount = settlementRows
    .filter((settlement) => settlement.status === 'Pending' || settlement.status === 'Processing')
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const pendingCount = settlementRows.filter(
    (settlement) => settlement.status === 'Pending' || settlement.status === 'Processing'
  ).length;
  const completedAmount = settlementRows
    .filter((settlement) => settlement.status === 'Completed')
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const completedCount = settlementRows.filter((settlement) => settlement.status === 'Completed').length;
  const failedCount = settlementRows.filter((settlement) => settlement.status === 'Failed').length;

  return [
    {
      key: 'total_vendor_payout_due',
      title: 'Total Vendor Payout Due',
      value: formatCurrency(payoutDueAmount),
      description: `${pendingCount} pending or processing settlement${pendingCount === 1 ? '' : 's'} in the payout queue`
    },
    {
      key: 'settlements_pending',
      title: 'Settlements Pending',
      value: formatCurrency(payoutDueAmount),
      description: 'Awaiting finance release, bank confirmation or retry'
    },
    {
      key: 'settlements_completed',
      title: 'Settlements Completed',
      value: formatCurrency(completedAmount),
      description: `${completedCount} payout${completedCount === 1 ? '' : 's'} closed successfully`
    },
    {
      key: 'failed_transactions',
      title: 'Failed Transactions',
      value: String(failedCount),
      description: 'Needs finance follow-up and retry'
    }
  ];
}

function buildRevenueBreakdown(orderRows, range, periodLabel) {
  const filtered = orderRows.filter(o => isWithinRange(o.createdAt, range));
  const paid = filtered.filter(o => o.paymentStatus === 'Paid');
  const refunded = filtered.filter(o => o.paymentStatus === 'Refunded');

  const grossGMV = filtered.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const platformCommission = paid.reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
  const refundAmount = refunded.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  
  const paidRevenue = paid.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const vendorPayout = paidRevenue - platformCommission;
  const netPlatformRevenue = platformCommission; // For now

  return [
    {
      key: 'gross_gmv',
      title: 'Gross GMV',
      value: formatCurrency(grossGMV),
      description: `Total platform billings ${periodLabel.toLowerCase()}`
    },
    {
      key: 'platform_commission',
      title: 'Platform Commission',
      value: formatCurrency(platformCommission),
      description: 'Commission earned from successful orders'
    },
    {
      key: 'vendor_payout',
      title: 'Vendor Payout',
      value: formatCurrency(vendorPayout),
      description: 'Net amount payable to service partners'
    },
    {
      key: 'refund_amount',
      title: 'Refund Amount',
      value: formatCurrency(refundAmount),
      description: 'Total value of processed refunds'
    },
    {
      key: 'net_platform_revenue',
      title: 'Net Platform Revenue',
      value: formatCurrency(netPlatformRevenue),
      description: 'Final platform earnings after adjustments'
    }
  ];
}

function buildGrowthMetrics(orderRows) {
  if (orderRows.length === 0) {
    return [
      { key: 'customer_retention', title: 'Customer Retention %', value: '0%', detail: 'No repeat customer activity yet' },
      { key: 'repeat_order_rate', title: 'Repeat Order Rate', value: '0%', detail: 'No repeat orders yet' },
      { key: 'top_vendor', title: 'Top Performing Vendor', value: 'N/A', detail: 'No live vendor revenue yet' },
      { key: 'worst_sla_vendor', title: 'Worst SLA Vendor', value: 'N/A', detail: 'No SLA breaches recorded yet' },
      { key: 'avg_turnaround', title: 'Avg Turnaround Time', value: '0 hrs', detail: 'No completed turnaround data yet' }
    ];
  }

  const customerOrders = new Map();
  const vendorPerformance = new Map();

  orderRows.forEach((order) => {
    customerOrders.set(order.phone, (customerOrders.get(order.phone) || 0) + 1);

    const vendor = vendorPerformance.get(order.vendor) || {
      revenue: 0,
      total: 0,
      issueCount: 0
    };

    vendor.revenue += order.amount;
    vendor.total += 1;
    if (order.status === 'Issue Reported' || order.status === 'Pickup Delayed') {
      vendor.issueCount += 1;
    }

    vendorPerformance.set(order.vendor, vendor);
  });

  const activeCustomers = Array.from(customerOrders.values()).filter((count) => count > 0).length;
  const retainedCustomers = Array.from(customerOrders.values()).filter((count) => count > 1).length;
  const repeatOrders = Array.from(customerOrders.values())
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count, 0);

  const topVendor = Array.from(vendorPerformance.entries()).sort((left, right) => right[1].revenue - left[1].revenue)[0];
  const worstSlaVendor = Array.from(vendorPerformance.entries()).sort((left, right) => {
    const leftRate = left[1].total === 0 ? 0 : left[1].issueCount / left[1].total;
    const rightRate = right[1].total === 0 ? 0 : right[1].issueCount / right[1].total;
    return rightRate - leftRate;
  })[0];

  const avgTurnaround =
    orderRows.reduce((sum, order) => sum + Number(order.turnaroundHours || 0), 0) / orderRows.length;

  return [
    {
      key: 'customer_retention',
      title: 'Customer Retention %',
      value: `${activeCustomers === 0 ? 0 : Math.round((retainedCustomers / activeCustomers) * 100)}%`,
      detail: 'Customers with more than one order in the live data set'
    },
    {
      key: 'repeat_order_rate',
      title: 'Repeat Order Rate',
      value: `${orderRows.length === 0 ? 0 : Math.round((repeatOrders / orderRows.length) * 100)}%`,
      detail: 'Share of orders coming from repeat customers'
    },
    {
      key: 'top_vendor',
      title: 'Top Performing Vendor',
      value: topVendor ? topVendor[0] : 'N/A',
      detail: topVendor ? formatCurrency(topVendor[1].revenue) : 'No revenue data yet'
    },
    {
      key: 'worst_sla_vendor',
      title: 'Worst SLA Vendor',
      value: worstSlaVendor ? worstSlaVendor[0] : 'N/A',
      detail: worstSlaVendor ? `${worstSlaVendor[1].issueCount} issue or delay orders` : 'No SLA risk yet'
    },
    {
      key: 'avg_turnaround',
      title: 'Avg Turnaround Time',
      value: `${Math.round(avgTurnaround || 0)} hrs`,
      detail: 'Average pickup-to-delivery turnaround'
    }
  ];
}

function buildIssueDigest(issueRecords) {
  return issueRecords
    .filter((issue) => issue.status !== 'Resolved')
    .sort((left, right) => {
      if (left.unread !== right.unread) return left.unread ? -1 : 1;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 20)
    .map((issue) => ({
      id: issue.id,
      orderId: issue.orderId || buildTransactionId(issue.supportTicketId || issue.id, 'TKT'),
      supportTicketId: issue.supportTicketId || null,
      type: issue.issueType,
      severity: issue.severity,
      vendor: issue.vendorName,
      summary: issue.summary,
      city: issue.city,
      unread: issue.unread,
      status: issue.status,
      assignedTo: issue.assignedTo || null,
      createdAt: issue.createdAt,
      vendorRiskLevel: issue.vendorRisk?.level || null,
      financialRiskAmount: issue.financialRisk ? `\u20b9${issue.financialRisk.amount}` : null,
      refundStatus: issue.refundStatus || null
    }));
}

function buildIssueRecords(issueAlerts, userMap) {
  const vendorRiskMap = buildVendorRiskMap(issueAlerts);

  return issueAlerts.map((issueAlert) => {
    const customer = issueAlert.customerId ? userMap.get(issueAlert.customerId) : null;
    const vendor = issueAlert.vendorId ? userMap.get(issueAlert.vendorId) : null;
    const vendorRisk = issueAlert.vendorId ? vendorRiskMap.get(issueAlert.vendorId) : null;
    const issueStatusLabel = getIssueStatusLabel(issueAlert.status);
    const issueSeverityLabel = getIssueSeverityLabel(issueAlert.severity);
    const refundStatusLabel = getRefundStatusLabel(issueAlert.refundStatus);
    const hoursOpen = calculateHoursOpen(issueAlert.createdAt, issueAlert.resolvedAt, issueAlert.status);
    const escalationTarget = issueAlert.escalatedTo || defaultEscalationTarget(issueAlert.issueType);

    let escalation;
    if (issueStatusLabel === 'Resolved') {
      escalation = { state: 'resolved', label: 'Resolved' };
    } else if (issueStatusLabel === 'Escalated' || hoursOpen >= issueAlert.autoEscalateAfterHours) {
      escalation = { state: 'active', label: `Escalated to ${escalationTarget}` };
    } else {
      escalation = {
        state: 'pending',
        label: `Auto escalates to ${escalationTarget} in ${Math.max(issueAlert.autoEscalateAfterHours - hoursOpen, 0)}h`
      };
    }

    return {
      id: issueAlert.id,
      orderId: issueAlert.orderId || buildTransactionId(issueAlert.supportTicketId || issueAlert.id, 'TKT'),
      supportTicketId: issueAlert.supportTicketId || null,
      type: issueAlert.issueType,
      severity: issueSeverityLabel,
      vendor: vendor ? getVendorDisplayName(vendor) : 'Unassigned',
      vendorPhone: vendor?.phone || 'N/A',
      vendorName: vendor ? getVendorDisplayName(vendor) : 'Unassigned',
      customer: getCustomerDisplayName(customer, issueAlert.customerId),
      customerPhone: customer?.phone || 'N/A',
      city: issueAlert.city || 'Unknown',
      status: issueStatusLabel,
      unread: Boolean(issueAlert.unread),
      date: toIsoDate(issueAlert.createdAt),
      hoursOpen,
      autoEscalateAfterHours: issueAlert.autoEscalateAfterHours,
      escalatedTo: issueAlert.escalatedTo || null,
      assignedTo: issueAlert.assignedTo || null,
      rootCause: issueAlert.rootCause || null,
      refundStatus: refundStatusLabel,
      description: issueAlert.description,
      summary: issueAlert.summary,
      icon: ISSUE_ICON_MAP[issueAlert.issueType] || 'generic',
      escalation,
      financialRisk: {
        label: issueAlert.financialRiskLabel || 'Estimated Refund Risk',
        amount: Math.round(Number(issueAlert.financialRiskAmount || 0))
      },
      vendorRisk: vendorRisk
        ? {
            level: vendorRisk.level,
            trigger: vendorRisk.trigger
          }
        : null,
      damageClaim: normalizeDamageClaim(issueAlert.damageClaim),
      createdAt: issueAlert.createdAt
    };
  });
}

function filterRows(rows, { range, search, status, vendor, city, tableStartDate, tableEndDate }) {
  return rows.filter((row) => {
    const createdAt = row.createdAt || row.date;

    const inRange = (tableStartDate || tableEndDate)
      ? ((!tableStartDate || toIsoDate(createdAt) >= tableStartDate) &&
         (!tableEndDate || toIsoDate(createdAt) <= tableEndDate))
      : isWithinRange(createdAt, range);

    return (
      inRange &&
      (status === 'all' || row.status === status) &&
      (vendor === 'all' || row.vendor === vendor) &&
      (city === 'all' || row.city === city) &&
      matchesSearch(
        [
          row.id,
          row.customer,
          row.vendor,
          row.city,
          row.phone,
          row.customerPhone,
          row.vendorPhone,
          row.transactionId,
          row.location,
          row.paymentStatus,
          row.orderType,
          row.pickupSlot,
          row.deliveryEta,
          row.issueSummary?.title,
          row.failureReason
        ],
        search
      )
    );
  });
}

function buildKpiCards(adminRole, filteredOrders, filteredSettlements, filteredIssues, monthOrders, allSettlements, periodLabel, growthStats, allUsers) {
  const activeUserCount = allUsers.filter(u => u.role === 'customer').length;
  const activeVendorCount = allUsers.filter(u => u.role === 'vendor' && u.vendorProfile?.isApproved).length;
  
  const monthPaidOrders = monthOrders.filter((order) => order.paymentStatus === 'Paid');
  const monthRevenue = monthPaidOrders.reduce((sum, order) => sum + order.amount, 0);
  
  const paidOrders = filteredOrders.filter((order) => order.paymentStatus === 'Paid');
  const selectedRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const selectedCommission = paidOrders.reduce((sum, order) => sum + Number(order.commissionAmount || 0), 0);
  const avgOrderValue = paidOrders.length === 0 ? 0 : selectedRevenue / paidOrders.length;
  
  const delayedOrders = filteredOrders.filter((order) => order.status === 'Pickup Delayed').length;
  const pendingOrders = filteredOrders.filter((order) =>
    ['Pending', 'Processing', 'Out for Delivery', 'Pickup Delayed', 'Issue Reported'].includes(order.status)
  ).length;

  const payoutDueAmount = allSettlements
    .filter((settlement) => settlement.status === 'Pending' || settlement.status === 'Processing')
    .reduce((sum, settlement) => sum + settlement.amount, 0);
    
  const settlementsCompletedAmount = filteredSettlements
    .filter((settlement) => settlement.status === 'PAID' || settlement.status === 'Completed')
    .reduce((sum, settlement) => sum + settlement.amount, 0);
    
  const failedTransactionsCount = filteredSettlements.filter(s => s.status === 'FAILED' || s.status === 'Failed').length;

  // Strategic Growth Metrics (BI) - Using month data for strategic depth
  const biOrders = monthOrders;
  const customerOrdersMap = new Map();
  biOrders.forEach(order => {
    const phone = order.customerPhone || order.userId;
    if (phone) customerOrdersMap.set(phone, (customerOrdersMap.get(phone) || 0) + 1);
  });
  const totalCustomersWithOrders = customerOrdersMap.size;
  const repeatCustomersCount = Array.from(customerOrdersMap.values()).filter(count => count > 1).length;
  const customerRetentionRate = totalCustomersWithOrders === 0 ? 0 : (repeatCustomersCount / totalCustomersWithOrders) * 100;
  const repeatOrdersCount = biOrders.filter(o => (customerOrdersMap.get(o.customerPhone || o.userId) || 0) > 1).length;
  const repeatOrderRate = biOrders.length === 0 ? 0 : (repeatOrdersCount / biOrders.length) * 100;

  const vendorStatsMap = new Map();
  biOrders.forEach(order => {
    const vName = order.vendor || 'Unknown';
    const vStats = vendorStatsMap.get(vName) || { revenue: 0, count: 0, issues: 0, completed: 0, turnaround: 0 };
    vStats.revenue += Number(order.amount || 0);
    vStats.count += 1;
    if (order.status === 'Issue Reported' || order.status === 'Pickup Delayed') vStats.issues += 1;
    if (order.turnaroundHours !== undefined && order.turnaroundHours !== null) {
      vStats.completed += 1;
      vStats.turnaround += Number(order.turnaroundHours);
    }
    vendorStatsMap.set(vName, vStats);
  });
  const vendorPerformance = Array.from(vendorStatsMap.entries()).map(([name, s]) => ({
    name,
    issueRate: s.count === 0 ? 0 : (s.issues / s.count),
    revenue: s.revenue,
    avgTurnaround: s.completed === 0 ? 0 : (s.turnaround / s.completed)
  }));
  const topVendor = vendorPerformance.sort((a,b) => b.revenue - a.revenue)[0]?.name || 'N/A';
  const worstVendor = vendorPerformance.sort((a,b) => b.issueRate - a.issueRate)[0]?.name || 'N/A';
  const systemAvgTurnaround = vendorPerformance.filter(v => v.avgTurnaround > 0).reduce((sum, v) => sum + v.avgTurnaround, 0) / (vendorPerformance.filter(v => v.avgTurnaround > 0).length || 1);



  const revenueGrowthNote = growthStats?.revenueGrowth !== undefined 
    ? `${growthStats.revenueGrowth >= 0 ? '+' : ''}${growthStats.revenueGrowth.toFixed(1)}% from previous period`
    : 'Live order volume';

  const cards = {
    activeUsers: {
      key: 'active_users',
      title: 'Active Users',
      value: activeUserCount,
      accent: 'blue'
    },
    activeVendors: {
      key: 'active_vendors',
      title: 'Active Vendors',
      value: activeVendorCount,
      accent: 'indigo'
    },
    ordersPeriod: {
      key: 'orders_today',
      title: `Orders ${periodLabel}`,
      value: filteredOrders.length,
      accent: 'blue'
    },
    revenuePeriod: {
      key: 'revenue_today',
      title: `Revenue ${periodLabel}`,
      value: formatCurrency(selectedRevenue),
      accent: 'emerald'
    },
    pendingOrders: {
      key: 'pending_orders',
      title: 'Pending Orders',
      value: pendingOrders,
      accent: 'amber'
    },
    issueCount: {
      key: 'issue_reported_count',
      title: 'Issue Reported Count',
      value: filteredIssues.filter((issue) => issue.status !== 'Resolved').length,
      accent: 'red'
    },
    avgOrderValue: {
      key: 'avg_order_value',
      title: 'Avg Order Value (AOV)',
      value: formatCurrency(avgOrderValue),
      accent: 'indigo'
    },
    payoutDue: {
      key: 'vendor_payout_due',
      title: 'Vendor Payout Due',
      value: formatCurrency(payoutDueAmount),
      accent: 'violet'
    },
    settlementPendingAmount: {
      key: 'settlement_pending_amount',
      title: 'Settlement Pending Amount',
      value: formatCurrency(payoutDueAmount),
      accent: 'slate'
    },
    grossPlatformRevenue: {
      key: 'gross_platform_revenue_month',
      title: 'Gross Platform Revenue (This Month)',
      value: formatCurrency(monthRevenue),
      accent: 'emerald'
    },
    netCommissionEarned: {
      key: 'net_commission_earned',
      title: 'Net Commission Earned',
      value: formatCurrency(selectedCommission),
      accent: 'blue'
    },
    settlementsCompleted: {
      key: 'settlements_completed',
      title: 'Settlements Completed',
      value: formatCurrency(settlementsCompletedAmount),
      accent: 'emerald'
    },
    failedTransactions: {
      key: 'failed_transactions',
      title: 'Failed Transactions',
      value: failedTransactionsCount,
      accent: 'red'
    },
    pickupDelays: {
      key: 'pickup_delay_count',
      title: 'Active Pickup Delays',
      value: delayedOrders,
      accent: 'orange'
    },
    pendingSettlementsCount: {
      key: 'pending_settlements_count',
      title: 'Queue: Pending Settlements',
      value: allSettlements.filter(s => s.status === 'Pending' || s.status === 'Processing').length,
      accent: 'amber'
    },
    customerRetention: {
      key: 'customer_retention',
      title: 'Customer Retention %',
      value: `${customerRetentionRate.toFixed(1)}%`,
      accent: 'emerald'
    },
    repeatOrderRate: {
      key: 'repeat_order_rate',
      title: 'Repeat Order Rate',
      value: `${repeatOrderRate.toFixed(1)}%`,
      accent: 'blue'
    },
    topVendor: {
      key: 'top_vendor',
      title: 'Top Performing Vendor',
      value: topVendor,
      accent: 'indigo'
    },
    worstSLAVendor: {
      key: 'worst_sla_vendor',
      title: 'Worst SLA Vendor',
      value: worstVendor,
      accent: 'red'
    },
    avgTurnaround: {
      key: 'avg_turnaround',
      title: 'Avg Turnaround Time',
      value: `${systemAvgTurnaround.toFixed(1)} hrs`,
      accent: 'amber'
    }
  };

  if (adminRole === ADMIN_ROLES.FINANCE_ADMIN) {
    return [
      cards.payoutDue,
      cards.pendingSettlementsCount,
      cards.settlementsCompleted,
      cards.netCommissionEarned,
      cards.failedTransactions,
      cards.grossPlatformRevenue
    ];
  }

  if (adminRole === ADMIN_ROLES.OPERATIONS_ADMIN) {
    return [
      cards.ordersPeriod,
      cards.pendingOrders,
      cards.pickupDelays,
      cards.issueCount
    ];
  }

  return [
    cards.activeUsers,
    cards.activeVendors,
    cards.ordersPeriod,
    cards.revenuePeriod,
    cards.grossPlatformRevenue,
    cards.pendingOrders,
    cards.issueCount,
    cards.avgOrderValue,
    cards.payoutDue,
    cards.settlementPendingAmount,
    cards.netCommissionEarned,
    cards.settlementsCompleted,
    cards.failedTransactions,
    cards.customerRetention,
    cards.repeatOrderRate,
    cards.topVendor,
    cards.worstSLAVendor,
    cards.avgTurnaround
  ];
}

function buildIssueStats(issueRecords, orderRows) {
  const currentMonthRange = getPeriodRange('this_month');
  const monthOrders = orderRows.filter((order) => isWithinRange(order.createdAt, currentMonthRange));
  const monthIssues = issueRecords.filter((issue) => isWithinRange(issue.createdAt, currentMonthRange));
  const grossRevenue = monthOrders
    .filter((order) => order.paymentStatus === 'Paid')
    .reduce((sum, order) => sum + order.amount, 0);
  const damageIssues = monthIssues.filter((issue) => issue.type === 'Item Damaged').length;
  const noShowIssues = monthIssues.filter((issue) => issue.type === 'Customer No-Show').length;
  const refundExposure = monthIssues.reduce((sum, issue) => sum + issue.financialRisk.amount, 0);
  const resolvedIssues = monthIssues.filter((issue) => issue.status === 'Resolved' && issue.hoursOpen > 0);
  const avgResolution = resolvedIssues.length === 0
    ? monthIssues.reduce((sum, issue) => sum + issue.hoursOpen, 0) / Math.max(monthIssues.length, 1)
    : resolvedIssues.reduce((sum, issue) => sum + issue.hoursOpen, 0) / resolvedIssues.length;

  const vendorIssueMap = new Map();
  monthIssues.forEach((issue) => {
    vendorIssueMap.set(issue.vendor, (vendorIssueMap.get(issue.vendor) || 0) + 1);
  });

  const topProblemVendor = Array.from(vendorIssueMap.entries()).sort((left, right) => right[1] - left[1])[0];

  return {
    summaryCards: [
      { key: 'critical', title: 'Critical Issues', value: issueRecords.filter((issue) => issue.severity === 'Critical').length, accent: 'red' },
      { key: 'high', title: 'High Priority', value: issueRecords.filter((issue) => issue.severity === 'High').length, accent: 'orange' },
      { key: 'open', title: 'Open or Escalated', value: issueRecords.filter((issue) => issue.status !== 'Resolved').length, accent: 'amber' },
      { key: 'unread', title: 'Unread Alerts', value: issueRecords.filter((issue) => issue.unread).length, accent: 'emerald' }
    ],
    monthlyReport: [
      {
        key: 'damage_rate',
        title: 'Damage Rate %',
        value: `${monthOrders.length === 0 ? 0 : Math.round((damageIssues / monthOrders.length) * 100)}%`
      },
      {
        key: 'no_show_rate',
        title: 'No-show Rate %',
        value: `${monthOrders.length === 0 ? 0 : Math.round((noShowIssues / monthOrders.length) * 100)}%`
      },
      {
        key: 'refund_pct',
        title: 'Refund % of Revenue',
        value: `${grossRevenue === 0 ? 0 : Math.round((refundExposure / grossRevenue) * 100)}%`
      },
      {
        key: 'problem_vendor',
        title: 'Top Problematic Vendors',
        value: topProblemVendor ? topProblemVendor[0] : 'N/A'
      },
      {
        key: 'avg_resolution_time',
        title: 'Average Resolution Time',
        value: `${Math.round(avgResolution || 0)} hrs`
      }
    ]
  };
}

async function getDashboardOverview({
  adminRole,
  period = 'today',
  startDate,
  endDate,
  search = '',
  status = 'all',
  vendor = 'all',
  city = 'all',
  date = '',
  tableStartDate,
  tableEndDate
}) {
  const role = adminRole || ADMIN_ROLES.SUPER_ADMIN;
  const range = getPeriodRange(period, startDate, endDate);
  const periodLabel = getPeriodLabel(period, startDate, endDate);
  const roleConfig = getRoleConfiguration(role);
  const context = await getBaseContext();

  try {
    await syncIssueAlerts(context);
  } catch (syncError) {
    console.error('[DashboardOverview] Sync Issues Error (Continuing...):', syncError);
  }

  const latestAlerts = await prisma.adminIssueAlert.findMany({
    orderBy: [{ unread: 'desc' }, { updatedAt: 'desc' }]
  });

  const issueRecords = buildIssueRecords(latestAlerts, context.userMap);
  const orderRows = buildOrderRows(context.orders, context.userMap, latestAlerts);
  const settlementRows = buildSettlementRows(context.settlements, context.userMap);
  const approvals = buildApprovals(context.users);
  const monthOrders = orderRows.filter((order) => isWithinRange(order.createdAt, getPeriodRange('this_month')));

  const filteredOrders = filterRows(orderRows, { range, search, status, vendor, city, tableStartDate, tableEndDate });
  const filteredSettlements = filterRows(settlementRows, { range, search, status, vendor, city, tableStartDate, tableEndDate });
  
  // Calculate Growth for Revenue
  const prevRange = getPreviousPeriodRange(period, range.start);
  let growthStats = { revenueGrowth: 0 };
  if (prevRange) {
    const currentRevenue = orderRows
      .filter(o => isWithinRange(o.createdAt, range) && o.paymentStatus === 'Paid')
      .reduce((sum, o) => sum + o.amount, 0);
    const prevRevenue = orderRows
      .filter(o => isWithinRange(o.createdAt, prevRange) && o.paymentStatus === 'Paid')
      .reduce((sum, o) => sum + o.amount, 0);
    
    if (prevRevenue > 0) {
      growthStats.revenueGrowth = ((currentRevenue - prevRevenue) / prevRevenue) * 100;
    } else if (currentRevenue > 0) {
      growthStats.revenueGrowth = 100;
    }
  }

  const filteredIssues = issueRecords.filter((issue) => {
    return (
      isWithinRange(issue.createdAt, range) &&
      matchesSearch(
        [
          issue.orderId,
          issue.supportTicketId,
          issue.vendor,
          issue.vendorPhone,
          issue.customer,
          issue.customerPhone,
          issue.city,
          issue.type,
          issue.summary,
          issue.description,
          issue.assignedTo
        ],
        search
      ) &&
      (status === 'all' || issue.status === status) &&
      (vendor === 'all' || issue.vendor === vendor) &&
      (city === 'all' || issue.city === city) &&
      (!date || issue.date === date)
    );
  });

  return {
    role,
    title: roleConfig.title,
    subtitle: roleConfig.subtitle,
    period,
    periodLabel,
    filters: {
      timeRangeOptions: [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'this_week', label: 'This Week' },
        { value: 'this_month', label: 'This Month' },
        { value: 'custom', label: 'Custom Date Range' }
      ],
      vendors: uniqueValues((role === ADMIN_ROLES.FINANCE_ADMIN ? settlementRows : orderRows).map((row) => row.vendor)),
      cities: uniqueValues((role === ADMIN_ROLES.FINANCE_ADMIN ? settlementRows : orderRows).map((row) => row.city)),
      statuses: uniqueValues((role === ADMIN_ROLES.FINANCE_ADMIN ? settlementRows : orderRows).map((row) => row.status))
    },
    searchPlaceholder:
      role === ADMIN_ROLES.FINANCE_ADMIN
        ? 'Search by transaction ID, vendor name or city'
        : 'Search by order ID, phone number, vendor name, city or transaction ID',
    kpis: buildKpiCards(
      role,
      filteredOrders,
      filteredSettlements,
      filteredIssues,
      monthOrders,
      settlementRows,
      periodLabel,
      growthStats,
      context.users
    ),
    revenueBreakdown: role === ADMIN_ROLES.OPERATIONS_ADMIN ? [] : buildRevenueBreakdown(orderRows, range, periodLabel),
    financeSnapshot: role === ADMIN_ROLES.OPERATIONS_ADMIN ? [] : buildFinanceSnapshot(settlementRows),
    growthMetrics: role === ADMIN_ROLES.SUPER_ADMIN ? buildGrowthMetrics(orderRows) : [],
    approvals: role === ADMIN_ROLES.FINANCE_ADMIN ? [] : approvals,
    issueDigest: role === ADMIN_ROLES.FINANCE_ADMIN ? [] : buildIssueDigest(issueRecords),
    riders: role === ADMIN_ROLES.OPERATIONS_ADMIN || role === ADMIN_ROLES.SUPER_ADMIN ? buildRiderSnapshot(context.orders, context.users) : [],
    primaryTable:
      role === ADMIN_ROLES.FINANCE_ADMIN
        ? {
            type: 'settlements',
            title: 'Settlement Pipeline',
            description: 'Live settlement movement across pending, completed and failed payout runs.',
            rows: filteredSettlements
          }
        : {
            type: 'orders',
            title: 'Recent Orders',
            description: 'Live operational order view with issue, city, payment and SLA visibility.',
            rows: filteredOrders
          },
    summary: {
      pendingApprovals: approvals.length,
      openIssues: issueRecords.filter((issue) => issue.status !== 'Resolved').length,
      unreadIssues: issueRecords.filter((issue) => issue.unread).length
    }
  };
}

async function getIssues({
  search = '',
  city = 'all',
  vendor = 'all',
  type = 'all',
  status = 'all',
  severity = 'all',
  dateRange = 'all',
  startDate,
  endDate,
  date = '',
  assignedTo = 'all',
  rootCause = 'all',
  refundStatus = 'all'
}) {
  const context = await getBaseContext();

  try {
    await syncIssueAlerts(context);
  } catch (syncError) {
    console.error('[getIssues] Sync Issues Error (Continuing...):', syncError);
  }

  const latestAlerts = await prisma.adminIssueAlert.findMany({
    orderBy: [{ unread: 'desc' }, { updatedAt: 'desc' }]
  });

  const orderRows = buildOrderRows(context.orders, context.userMap, latestAlerts);
  const issueRecords = buildIssueRecords(latestAlerts, context.userMap);
  const range = getIssueDateRange(dateRange, startDate, endDate);

  const filteredIssues = issueRecords.filter((issue) => {
    const matchesDate = range ? isWithinRange(issue.createdAt, range) : true;

    return (
      matchesDate &&
      (!date || issue.date === date) &&
      matchesSearch(
        [
          issue.orderId,
          issue.supportTicketId,
          issue.vendor,
          issue.vendorPhone,
          issue.customer,
          issue.customerPhone,
          issue.city,
          issue.type,
          issue.summary,
          issue.description,
          issue.assignedTo
        ],
        search
      ) &&
      (city === 'all' || issue.city === city) &&
      (vendor === 'all' || issue.vendor === vendor) &&
      (type === 'all' || issue.type === type) &&
      (status === 'all' || issue.status === status) &&
      (severity === 'all' || issue.severity === severity) &&
      (assignedTo === 'all' || issue.assignedTo === assignedTo) &&
      (rootCause === 'all' || issue.rootCause === rootCause) &&
      (refundStatus === 'all' || issue.refundStatus === refundStatus)
    );
  });

  const stats = buildIssueStats(issueRecords, orderRows);

  return {
    filters: {
      cities: uniqueValues(issueRecords.map((issue) => issue.city)),
      vendors: uniqueValues(issueRecords.map((issue) => issue.vendor)),
      issueTypes: uniqueValues(issueRecords.map((issue) => issue.type)),
      statuses: uniqueValues(issueRecords.map((issue) => issue.status)),
      severities: uniqueValues(issueRecords.map((issue) => issue.severity)),
      rootCauses: ROOT_CAUSES,
      teamMembers: TEAM_MEMBERS,
      refundStatuses: REFUND_STATUSES
    },
    issues: filteredIssues,
    summaryCards: stats.summaryCards,
    monthlyReport: stats.monthlyReport
  };
}

async function markAllIssuesReviewed() {
  const result = await prisma.adminIssueAlert.updateMany({
    where: { unread: true },
    data: {
      unread: false,
      reviewedAt: new Date()
    }
  });

  return { reviewedCount: result.count };
}

async function updateIssue(issueId, payload = {}) {
  const currentIssue = await prisma.adminIssueAlert.findUnique({
    where: { id: issueId }
  });

  if (!currentIssue) return null;

  const hasAssignedTo = Object.prototype.hasOwnProperty.call(payload, 'assignedTo');
  const hasRootCause = Object.prototype.hasOwnProperty.call(payload, 'rootCause');
  const hasRefundStatus = Object.prototype.hasOwnProperty.call(payload, 'refundStatus');
  const hasDamageClaim = Object.prototype.hasOwnProperty.call(payload, 'damageClaim');
  const damageClaimPayload = buildJsonObject(payload.damageClaim);
  const nextDamageClaim = {
    ...(normalizeDamageClaim(currentIssue.damageClaim) || {}),
    ...damageClaimPayload
  };

  if (damageClaimPayload.damageImageFile) {
    const damageImageAsset = await persistIssueClaimImage(
      issueId,
      'damage',
      damageClaimPayload.damageImageFile
    );
    nextDamageClaim.damageImageUploaded = true;
    nextDamageClaim.damageImageUrl = damageImageAsset.url;
    nextDamageClaim.damageImageName = damageImageAsset.name;
  }

  if (damageClaimPayload.preCleanImageFile) {
    const preCleanImageAsset = await persistIssueClaimImage(
      issueId,
      'pre-clean',
      damageClaimPayload.preCleanImageFile
    );
    nextDamageClaim.preCleanImageUploaded = true;
    nextDamageClaim.preCleanImageUrl = preCleanImageAsset.url;
    nextDamageClaim.preCleanImageName = preCleanImageAsset.name;
  }

  delete nextDamageClaim.damageImageFile;
  delete nextDamageClaim.preCleanImageFile;

  const data = {
    unread: false,
    reviewedAt: new Date()
  };

  if (hasAssignedTo) {
    data.assignedTo = payload.assignedTo || null;
  }

  if (hasRootCause) {
    data.rootCause = payload.rootCause || null;
  }

  if (hasRefundStatus) {
    data.refundStatus = getRefundStatusValue(
      payload.refundStatus || currentIssue.refundStatus || ISSUE_REFUND_STATUSES.NOT_INITIATED
    );
  }

  if (hasDamageClaim) {
    data.damageClaim = nextDamageClaim;
  }

  if (payload.action === 'assign' && payload.assignedTo) {
    data.assignedTo = payload.assignedTo;
    data.status =
      getIssueStatusValue(currentIssue.status) === ISSUE_ALERT_STATUSES.OPEN
        ? ISSUE_ALERT_STATUSES.INVESTIGATING
        : currentIssue.status;
  }

  if (payload.action === 'review') {
    data.unread = false;
  }

  if (payload.action === 'escalate') {
    data.status = ISSUE_ALERT_STATUSES.ESCALATED;
    data.escalatedTo =
      payload.escalatedTo || currentIssue.escalatedTo || defaultEscalationTarget(currentIssue.issueType);
    // Auto-assign to Operations Team so it appears on Ops Dashboard
    if (!currentIssue.assignedTo) {
      data.assignedTo = 'Operations Team';
    }
  }

  if (payload.action === 'resolve') {
    data.status = ISSUE_ALERT_STATUSES.RESOLVED;
    data.rootCause = payload.rootCause || currentIssue.rootCause;
    data.refundStatus = getRefundStatusValue(
      payload.refundStatus || currentIssue.refundStatus || ISSUE_REFUND_STATUSES.NOT_INITIATED
    );
    data.assignedTo = payload.assignedTo || currentIssue.assignedTo;
    data.resolvedAt = new Date();
    data.damageClaim = nextDamageClaim;
  }

  const updatedIssue = await prisma.adminIssueAlert.update({
    where: { id: issueId },
    data
  });

  const shouldMoveTicketToInProgress =
    currentIssue.supportTicketId &&
    payload.action !== 'resolve' &&
    (payload.action === 'assign' ||
      payload.action === 'escalate' ||
      hasAssignedTo ||
      hasRootCause ||
      hasRefundStatus ||
      hasDamageClaim);

  if (shouldMoveTicketToInProgress) {
    await prisma.supportTicket
      .updateMany({
        where: { id: currentIssue.supportTicketId },
        data: {
          status: 'in_progress',
          isEscalated:
            payload.action === 'escalate'
              ? true
              : getIssueStatusValue(currentIssue.status) === ISSUE_ALERT_STATUSES.ESCALATED
        }
      })
      .catch((err) => console.error('Failed to update ticket status:', err.message));
  }

  if (payload.action === 'escalate' && currentIssue.supportTicketId) {
    await prisma.supportTicket
      .updateMany({
        where: { id: currentIssue.supportTicketId },
        data: {
          isEscalated: true,
          status: 'in_progress'
        }
      })
      .catch((err) => console.error('Failed to escalate ticket:', err.message));
  }

  if (payload.action === 'resolve') {
    if (currentIssue.supportTicketId) {
      await prisma.supportTicket
        .updateMany({
          where: { id: currentIssue.supportTicketId },
          data: {
            status: 'resolved',
            isEscalated: false,
            resolvedAt: new Date()
          }
        })
        .catch((err) => console.error('Failed to resolve ticket:', err.message));
    }

    if (currentIssue.orderId) {
      await resolveAdminOrderIssue(currentIssue.orderId).catch((error) => {
        console.error(`Failed to resolve order issue ${currentIssue.orderId}:`, error.message);
      });
    }
  }

  return updatedIssue;
}

function buildRiderSnapshot(orders, users) {
  const riders = users.filter(u => u.role === 'rider');
  const riderStats = new Map();

  riders.forEach(rider => {
    riderStats.set(rider.id, {
      id: rider.id,
      name: rider.name,
      deliveries: 0,
      issues: 0,
      delays: 0,
      rating: rider.vendorProfile?.rating || 4.5,
      status: rider.status === 'active' ? 'online' : 'offline'
    });
  });

  orders.forEach(order => {
    if (!order.riderId) return;
    const stats = riderStats.get(order.riderId);
    if (!stats) return;

    if (order.status === 'delivered') stats.deliveries += 1;
    if (order.status === 'pickup_delayed') stats.delays += 1;
    if (order.hasIssue) stats.issues += 1;
    
    // If out for delivery, set status to on_delivery
    if (order.status === 'out_for_delivery' || order.status === 'picked_up') {
      stats.status = 'on_delivery';
    }
  });

  return Array.from(riderStats.values())
    .map(r => {
      const onTime = r.deliveries === 0 ? 100 : Math.round(((r.deliveries - r.delays) / r.deliveries) * 100);
      return {
        ...r,
        onTime: Math.max(0, onTime)
      };
    })
    .sort((a, b) => b.deliveries - a.deliveries)
    .slice(0, 10);
}

module.exports = {
  getDashboardOverview,
  getIssues,
  markAllIssuesReviewed,
  updateIssue
};

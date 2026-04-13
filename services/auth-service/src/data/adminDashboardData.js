const { PrismaClient } = require('@prisma/client');

const { ADMIN_ROLES } = require('../config/adminAccess');
const { fetchAllAdminOrders, resolveAdminOrderIssue } = require('../utils/orderServiceClient');

const prisma = new PrismaClient();

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
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
  if (period === 'custom' && startDate && endDate) return `${startDate} to ${endDate}`;
  return 'Today';
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

  if (issueAlert && issueAlert.status !== 'Resolved') {
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
  if (issueAlert && issueAlert.status !== 'Resolved') {
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
    damageImageUploaded: Boolean(damageClaim.damageImageUploaded),
    preCleanImageUploaded: Boolean(damageClaim.preCleanImageUploaded),
    invoiceValue: Number(damageClaim.invoiceValue || 0),
    liabilityCap: Number(damageClaim.liabilityCap || 0)
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

function calculateHoursOpen(createdAt, resolvedAt, status) {
  const end = status === 'Resolved' && resolvedAt ? new Date(resolvedAt) : new Date();
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
  if (ticket.status === 'resolved' || ticket.status === 'closed') return 'Resolved';
  if (ticket.isEscalated) return 'Escalated';
  if (ticket.status === 'in_progress') return 'Investigating';
  return 'Open';
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
  const [orders, users, settlements, supportTickets, existingAlerts] = await Promise.all([
    getOrders(),
    prisma.user.findMany({
      include: {
        vendorProfile: true,
        addresses: true,
        outlets: true
      }
    }),
    prisma.vendorSettlement.findMany({
      orderBy: { createdAt: 'desc' }
    }),
    prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' }
    }),
    prisma.adminIssueAlert.findMany({
      orderBy: { createdAt: 'desc' }
    })
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
      severity: config.severity,
      status: 'Open',
      unread: true,
      city,
      description: order.issueNote || `${config.issueType} reported on order ${order.id}.`,
      summary: order.issueNote || `${config.issueType} requires admin review for ${location}.`,
      assignedTo: defaultAssignee(config.issueType),
      refundStatus: order.paymentStatus === 'refunded' ? 'Completed' : 'Not Initiated',
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
      severity: config.severity,
      status: mapSupportTicketStatus(ticket),
      unread: ticket.status !== 'resolved' && ticket.status !== 'closed',
      city,
      description: ticket.message || ticket.subject,
      summary: ticket.subject || `${config.issueType} support alert`,
      assignedTo: defaultAssignee(config.issueType),
      refundStatus: 'Not Initiated',
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

  let status = existingAlert?.status || seedData.status || 'Open';
  if (seedData.status === 'Resolved') status = 'Resolved';
  if (existingAlert?.status === 'Resolved') status = 'Resolved';

  return {
    orderId: seedData.orderId,
    supportTicketId: seedData.supportTicketId,
    customerId: seedData.customerId,
    vendorId: seedData.vendorId,
    issueType: seedData.issueType,
    severity: seedData.severity,
    status,
    unread: status === 'Resolved' ? false : existingAlert ? existingAlert.unread : seedData.unread,
    city: seedData.city,
    description: seedData.description,
    summary: seedData.summary,
    assignedTo: existingAlert?.assignedTo || seedData.assignedTo || defaultAssignee(seedData.issueType),
    rootCause: existingAlert?.rootCause || null,
    refundStatus: existingAlert?.refundStatus || seedData.refundStatus || 'Not Initiated',
    escalatedTo:
      existingAlert?.escalatedTo ||
      seedData.escalatedTo ||
      (status === 'Escalated' ? defaultEscalationTarget(seedData.issueType) : null),
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
      status === 'Resolved' ? existingAlert?.resolvedAt || new Date() : existingAlert?.resolvedAt || null
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
        status: { not: 'Resolved' }
      },
      data: {
        status: 'Resolved',
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
      issueSummary:
        issueAlert && issueAlert.status !== 'Resolved'
          ? {
              severity: issueAlert.severity,
              title: issueAlert.issueType,
              summary: issueAlert.summary
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
      new Date(new Date(settlement.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const status =
      settlement.status === 'paid'
        ? 'Completed'
        : settlement.status === 'failed'
          ? 'Failed'
          : 'Pending';

    return {
      id: settlement.id,
      vendor: vendor ? getVendorDisplayName(vendor) : `Vendor ${shortId(settlement.vendorId)}`,
      city: deriveCityFromAddress(getPrimaryAddress(vendor)) || 'Unknown',
      amount: Number(settlement.amount || 0),
      status,
      dueDate: toIsoDate(dueDate),
      transactionId: buildTransactionId(settlement.id, 'SETTLE'),
      failureReason: status === 'Failed' ? settlement.note || 'Payout transfer failed' : null,
      createdAt: settlement.createdAt
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
    .filter((settlement) => settlement.status === 'Pending')
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const pendingCount = settlementRows.filter((settlement) => settlement.status === 'Pending').length;
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
      description: `${pendingCount} pending settlement${pendingCount === 1 ? '' : 's'} in the payout queue`
    },
    {
      key: 'settlements_pending',
      title: 'Settlements Pending',
      value: formatCurrency(payoutDueAmount),
      description: 'Awaiting finance release or bank confirmation'
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
    .slice(0, 5)
    .map((issue) => ({
      id: issue.id,
      orderId: issue.orderId || buildTransactionId(issue.supportTicketId || issue.id, 'TKT'),
      type: issue.issueType,
      severity: issue.severity,
      vendor: issue.vendorName,
      summary: issue.summary,
      city: issue.city,
      unread: issue.unread
    }));
}

function buildIssueRecords(issueAlerts, userMap) {
  const vendorRiskMap = buildVendorRiskMap(issueAlerts);

  return issueAlerts.map((issueAlert) => {
    const customer = issueAlert.customerId ? userMap.get(issueAlert.customerId) : null;
    const vendor = issueAlert.vendorId ? userMap.get(issueAlert.vendorId) : null;
    const vendorRisk = issueAlert.vendorId ? vendorRiskMap.get(issueAlert.vendorId) : null;
    const hoursOpen = calculateHoursOpen(issueAlert.createdAt, issueAlert.resolvedAt, issueAlert.status);
    const escalationTarget = issueAlert.escalatedTo || defaultEscalationTarget(issueAlert.issueType);

    let escalation;
    if (issueAlert.status === 'Resolved') {
      escalation = { state: 'resolved', label: 'Resolved' };
    } else if (issueAlert.status === 'Escalated' || hoursOpen >= issueAlert.autoEscalateAfterHours) {
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
      severity: issueAlert.severity,
      vendor: vendor ? getVendorDisplayName(vendor) : 'Unassigned',
      vendorPhone: vendor?.phone || 'N/A',
      vendorName: vendor ? getVendorDisplayName(vendor) : 'Unassigned',
      customer: getCustomerDisplayName(customer, issueAlert.customerId),
      customerPhone: customer?.phone || 'N/A',
      city: issueAlert.city || 'Unknown',
      status: issueAlert.status,
      unread: Boolean(issueAlert.unread),
      date: toIsoDate(issueAlert.createdAt),
      hoursOpen,
      autoEscalateAfterHours: issueAlert.autoEscalateAfterHours,
      escalatedTo: issueAlert.escalatedTo || null,
      assignedTo: issueAlert.assignedTo || null,
      rootCause: issueAlert.rootCause || null,
      refundStatus: issueAlert.refundStatus || 'Not Initiated',
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

function filterRows(rows, { range, search, status, vendor, city, date }) {
  return rows.filter((row) => {
    const createdAt = row.createdAt || row.date;

    return (
      isWithinRange(createdAt, range) &&
      (!date || toIsoDate(createdAt) === date) &&
      (status === 'all' || row.status === status) &&
      (vendor === 'all' || row.vendor === vendor) &&
      (city === 'all' || row.city === city) &&
      matchesSearch(
        [row.id, row.customer, row.vendor, row.city, row.phone, row.transactionId, row.location],
        search
      )
    );
  });
}

function buildKpiCards(adminRole, filteredOrders, filteredSettlements, filteredIssues, monthOrders, allSettlements, periodLabel) {
  const paidOrders = filteredOrders.filter((order) => order.paymentStatus === 'Paid');
  const selectedRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const avgOrderValue = paidOrders.length === 0 ? 0 : selectedRevenue / paidOrders.length;
  const pendingOrders = filteredOrders.filter((order) =>
    ['Pending', 'Processing', 'Out for Delivery', 'Pickup Delayed', 'Issue Reported'].includes(order.status)
  ).length;
  const monthRevenue = monthOrders
    .filter((order) => order.paymentStatus === 'Paid')
    .reduce((sum, order) => sum + order.amount, 0);
  const monthCommission = monthOrders
    .filter((order) => order.paymentStatus === 'Paid')
    .reduce((sum, order) => sum + Number(order.commissionAmount || 0), 0);
  const payoutDueAmount = allSettlements
    .filter((settlement) => settlement.status === 'Pending')
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const settlementsCompletedAmount = filteredSettlements
    .filter((settlement) => settlement.status === 'Completed')
    .reduce((sum, settlement) => sum + settlement.amount, 0);

  const cards = {
    ordersPeriod: {
      key: 'orders_today',
      title: `Orders ${periodLabel}`,
      value: filteredOrders.length,
      accent: 'blue',
      note: 'Live order volume'
    },
    revenuePeriod: {
      key: 'revenue_today',
      title: `Revenue ${periodLabel}`,
      value: formatCurrency(selectedRevenue),
      accent: 'emerald',
      note: 'Collected in selected view'
    },
    pendingOrders: {
      key: 'pending_orders',
      title: 'Pending Orders',
      value: pendingOrders,
      accent: 'amber',
      note: 'Needs action'
    },
    issueCount: {
      key: 'issue_reported_count',
      title: 'Issue Reported Count',
      value: filteredIssues.filter((issue) => issue.status !== 'Resolved').length,
      accent: 'red',
      note: 'Operational risk'
    },
    avgOrderValue: {
      key: 'avg_order_value',
      title: 'Avg Order Value (AOV)',
      value: formatCurrency(avgOrderValue),
      accent: 'indigo',
      note: 'Average paid basket'
    },
    grossRevenue: {
      key: 'gross_platform_revenue',
      title: 'Gross Platform Revenue (This Month)',
      value: formatCurrency(monthRevenue),
      accent: 'emerald',
      note: 'Gross billings'
    },
    netCommission: {
      key: 'net_commission_earned',
      title: 'Net Commission Earned',
      value: formatCurrency(monthCommission),
      accent: 'blue',
      note: 'Platform earnings'
    },
    payoutDue: {
      key: 'vendor_payout_due',
      title: 'Vendor Payout Due',
      value: formatCurrency(payoutDueAmount),
      accent: 'violet',
      note: 'Awaiting payout release'
    },
    settlementPendingAmount: {
      key: 'settlement_pending_amount',
      title: 'Settlement Pending Amount',
      value: formatCurrency(payoutDueAmount),
      accent: 'slate',
      note: 'Pending settlement exposure'
    },
    settlementsCompleted: {
      key: 'settlements_completed',
      title: 'Settlements Completed',
      value: formatCurrency(settlementsCompletedAmount),
      accent: 'emerald',
      note: 'Completed in selected view'
    }
  };

  if (adminRole === ADMIN_ROLES.OPERATIONS_ADMIN) {
    return [cards.ordersPeriod, cards.pendingOrders, cards.issueCount, cards.avgOrderValue];
  }

  if (adminRole === ADMIN_ROLES.FINANCE_ADMIN) {
    return [cards.grossRevenue, cards.netCommission, cards.payoutDue, cards.settlementPendingAmount, cards.settlementsCompleted];
  }

  return [
    cards.ordersPeriod,
    cards.revenuePeriod,
    cards.pendingOrders,
    cards.issueCount,
    cards.avgOrderValue,
    cards.grossRevenue,
    cards.netCommission,
    cards.payoutDue,
    cards.settlementPendingAmount
  ];
}

function buildIssueStats(issueRecords, orderRows) {
  const currentMonthRange = getPeriodRange('this_month');
  const monthOrders = orderRows.filter((order) => isWithinRange(order.createdAt, currentMonthRange));
  const grossRevenue = monthOrders
    .filter((order) => order.paymentStatus === 'Paid')
    .reduce((sum, order) => sum + order.amount, 0);
  const damageIssues = issueRecords.filter((issue) => issue.type === 'Item Damaged').length;
  const noShowIssues = issueRecords.filter((issue) => issue.type === 'Customer No-Show').length;
  const refundExposure = issueRecords.reduce((sum, issue) => sum + issue.financialRisk.amount, 0);
  const resolvedIssues = issueRecords.filter((issue) => issue.status === 'Resolved' && issue.hoursOpen > 0);
  const avgResolution = resolvedIssues.length === 0
    ? issueRecords.reduce((sum, issue) => sum + issue.hoursOpen, 0) / Math.max(issueRecords.length, 1)
    : resolvedIssues.reduce((sum, issue) => sum + issue.hoursOpen, 0) / resolvedIssues.length;

  const vendorIssueMap = new Map();
  issueRecords.forEach((issue) => {
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
  date = ''
}) {
  const role = adminRole || ADMIN_ROLES.SUPER_ADMIN;
  const range = getPeriodRange(period, startDate, endDate);
  const periodLabel = getPeriodLabel(period, startDate, endDate);
  const roleConfig = getRoleConfiguration(role);
  const context = await getBaseContext();

  await syncIssueAlerts(context);

  const latestAlerts = await prisma.adminIssueAlert.findMany({
    orderBy: [{ unread: 'desc' }, { updatedAt: 'desc' }]
  });

  const issueRecords = buildIssueRecords(latestAlerts, context.userMap);
  const orderRows = buildOrderRows(context.orders, context.userMap, latestAlerts);
  const settlementRows = buildSettlementRows(context.settlements, context.userMap);
  const approvals = buildApprovals(context.users);
  const monthOrders = orderRows.filter((order) => isWithinRange(order.createdAt, getPeriodRange('this_month')));

  const filteredOrders = filterRows(orderRows, { range, search, status, vendor, city, date });
  const filteredSettlements = filterRows(settlementRows, { range, search, status, vendor, city, date });
  const filteredIssues = issueRecords.filter((issue) => {
    return (
      isWithinRange(issue.createdAt, range) &&
      matchesSearch([issue.orderId, issue.vendor, issue.customer, issue.city, issue.type], search) &&
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
      periodLabel
    ),
    financeSnapshot: role === ADMIN_ROLES.OPERATIONS_ADMIN ? [] : buildFinanceSnapshot(settlementRows),
    growthMetrics: role === ADMIN_ROLES.SUPER_ADMIN ? buildGrowthMetrics(orderRows) : [],
    approvals: role === ADMIN_ROLES.FINANCE_ADMIN ? [] : approvals,
    issueDigest: role === ADMIN_ROLES.FINANCE_ADMIN ? [] : buildIssueDigest(issueRecords),
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
  dateRange = 'all'
}) {
  const context = await getBaseContext();

  await syncIssueAlerts(context);

  const latestAlerts = await prisma.adminIssueAlert.findMany({
    orderBy: [{ unread: 'desc' }, { updatedAt: 'desc' }]
  });

  const orderRows = buildOrderRows(context.orders, context.userMap, latestAlerts);
  const issueRecords = buildIssueRecords(latestAlerts, context.userMap);
  const range = dateRange === 'all' ? null : getPeriodRange(dateRange);

  const filteredIssues = issueRecords.filter((issue) => {
    const matchesDate = range ? isWithinRange(issue.createdAt, range) : true;

    return (
      matchesDate &&
      matchesSearch([issue.orderId, issue.vendor, issue.customer, issue.city, issue.type], search) &&
      (city === 'all' || issue.city === city) &&
      (vendor === 'all' || issue.vendor === vendor) &&
      (type === 'all' || issue.type === type) &&
      (status === 'all' || issue.status === status) &&
      (severity === 'all' || issue.severity === severity)
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
      teamMembers: TEAM_MEMBERS
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

  const nextDamageClaim = {
    ...(normalizeDamageClaim(currentIssue.damageClaim) || {}),
    ...buildJsonObject(payload.damageClaim)
  };

  const data = {
    unread: false,
    reviewedAt: new Date()
  };

  if (payload.action === 'assign' && payload.assignedTo) {
    data.assignedTo = payload.assignedTo;
    data.status = currentIssue.status === 'Open' ? 'Investigating' : currentIssue.status;
  }

  if (payload.action === 'review') {
    data.unread = false;
  }

  if (payload.action === 'escalate') {
    data.status = 'Escalated';
    data.escalatedTo =
      payload.escalatedTo || currentIssue.escalatedTo || defaultEscalationTarget(currentIssue.issueType);
  }

  if (payload.action === 'resolve') {
    data.status = 'Resolved';
    data.rootCause = payload.rootCause || currentIssue.rootCause;
    data.refundStatus = payload.refundStatus || currentIssue.refundStatus || 'Not Initiated';
    data.assignedTo = payload.assignedTo || currentIssue.assignedTo;
    data.resolvedAt = new Date();
    data.damageClaim = nextDamageClaim;
  }

  const updatedIssue = await prisma.adminIssueAlert.update({
    where: { id: issueId },
    data
  });

  if (payload.action === 'escalate' && currentIssue.supportTicketId) {
    await prisma.supportTicket
      .update({
        where: { id: currentIssue.supportTicketId },
        data: {
          isEscalated: true,
          status: 'in_progress'
        }
      })
      .catch(() => null);
  }

  if (payload.action === 'resolve') {
    if (currentIssue.supportTicketId) {
      await prisma.supportTicket
        .update({
          where: { id: currentIssue.supportTicketId },
          data: {
            status: 'resolved',
            isEscalated: false,
            resolvedAt: new Date()
          }
        })
        .catch(() => null);
    }

    if (currentIssue.orderId) {
      await resolveAdminOrderIssue(currentIssue.orderId).catch((error) => {
        console.error(`Failed to resolve order issue ${currentIssue.orderId}:`, error.message);
      });
    }
  }

  return updatedIssue;
}

module.exports = {
  getDashboardOverview,
  getIssues,
  markAllIssuesReviewed,
  updateIssue
};

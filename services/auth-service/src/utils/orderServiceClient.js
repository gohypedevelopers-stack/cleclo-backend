const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3003';

function buildUrl(path, params = {}) {
  const url = new URL(`${ORDER_SERVICE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function requestOrderService(path, { method = 'GET', params = {}, body } = {}) {
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || payload?.message || `Order service request failed with ${response.status}`);
  }

  return response.json();
}

async function fetchAllAdminOrders(params = {}) {
  return requestOrderService('/internal/orders', { params });
}

async function fetchAdminIssueOrders() {
  return requestOrderService('/admin/orders/issues');
}

async function resolveAdminOrderIssue(orderId) {
  return requestOrderService(`/admin/orders/${orderId}/resolve-issue`, {
    method: 'PATCH'
  });
}

module.exports = {
  fetchAllAdminOrders,
  fetchAdminIssueOrders,
  resolveAdminOrderIssue
};

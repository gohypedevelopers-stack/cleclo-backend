const ADMIN_ROLES = {
    SUPER_ADMIN: 'super_admin',
    OPERATIONS_ADMIN: 'operations_admin',
    FINANCE_ADMIN: 'finance_admin'
};

const ADMIN_ROLE_LABELS = {
    [ADMIN_ROLES.SUPER_ADMIN]: 'Super Admin',
    [ADMIN_ROLES.OPERATIONS_ADMIN]: 'Operations Admin',
    [ADMIN_ROLES.FINANCE_ADMIN]: 'Finance Admin'
};

const ADMIN_ROLE_PERMISSIONS = {
    [ADMIN_ROLES.SUPER_ADMIN]: {
        defaultRoute: '/',
        routePrefixes: [
            '/',
            '/app',
            '/home',
            '/services',
            '/wallet',
            '/master',
            '/users',
            '/customer',
            '/vendor',
            '/vendors',
            '/rider',
            '/riders',
            '/orders',
            '/finance',
            '/issues',
            '/support',
            '/settings'
        ]
    },
    [ADMIN_ROLES.OPERATIONS_ADMIN]: {
        defaultRoute: '/',
        routePrefixes: [
            '/',
            '/users',
            '/customer',
            '/vendor',
            '/vendors',
            '/rider',
            '/riders',
            '/orders',
            '/issues',
            '/support',
            '/settings'
        ]
    },
    [ADMIN_ROLES.FINANCE_ADMIN]: {
        defaultRoute: '/finance/settlements',
        routePrefixes: [
            '/',
            '/finance',
            '/vendor/payments',
            '/rider/payments'
        ]
    }
};

function getAdminPermissions(adminRole) {
    const permissions = ADMIN_ROLE_PERMISSIONS[adminRole] || ADMIN_ROLE_PERMISSIONS[ADMIN_ROLES.OPERATIONS_ADMIN];

    return {
        adminRole,
        roleLabel: ADMIN_ROLE_LABELS[adminRole] || 'Admin',
        defaultRoute: permissions.defaultRoute,
        routePrefixes: permissions.routePrefixes
    };
}

function isAdminRoleAllowed(adminRole, allowedRoles = []) {
    return allowedRoles.length === 0 || allowedRoles.includes(adminRole);
}

module.exports = {
    ADMIN_ROLES,
    ADMIN_ROLE_LABELS,
    ADMIN_ROLE_PERMISSIONS,
    getAdminPermissions,
    isAdminRoleAllowed
};

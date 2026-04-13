const {
    getDashboardOverview,
    getIssues,
    markAllIssuesReviewed,
    updateIssue
} = require('../data/adminDashboardData');

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
        res.status(500).json({ message: 'Failed to load dashboard overview', error: error.message });
    }
};

const getIssueAlertsHandler = async (req, res) => {
    try {
        const payload = await getIssues({
            search: req.query.search,
            city: req.query.city,
            vendor: req.query.vendor,
            type: req.query.type,
            status: req.query.status,
            severity: req.query.severity,
            dateRange: req.query.dateRange
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

module.exports = {
    getDashboardOverviewHandler,
    getIssueAlertsHandler,
    markAllIssuesReviewedHandler,
    updateIssueAlertHandler
};

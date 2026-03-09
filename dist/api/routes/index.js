"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const patients_1 = require("./patients");
const referrals_1 = require("./referrals");
const appointments_1 = require("./appointments");
const claims_1 = require("./claims");
const reports_1 = require("./reports");
const auth_1 = require("./auth");
function setupRoutes(app, db, config) {
    app.use('/api/auth', (0, auth_1.authRoutes)(db, config));
    app.use('/api/patients', (0, patients_1.patientRoutes)(db, config));
    app.use('/api/referrals', (0, referrals_1.referralRoutes)(db, config));
    app.use('/api/appointments', (0, appointments_1.appointmentRoutes)(db, config));
    app.use('/api/claims', (0, claims_1.claimRoutes)(db, config));
    app.use('/api/reports', (0, reports_1.reportRoutes)(db, config));
}
//# sourceMappingURL=index.js.map
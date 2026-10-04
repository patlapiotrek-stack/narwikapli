const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const nodemailer = require('nodemailer');
const { createMailService } = require('./mail-service.cjs');

initializeApp();
const smtpPassword = defineSecret('OVH_SMTP_PASSWORD');
const service = createMailService({ db: getFirestore(), createTransport: nodemailer.createTransport,
    getPassword: () => smtpPassword.value(), HttpError: HttpsError, logError: details => logger.error('OVH SMTP failure', details) });
const options = { region: 'europe-west1', maxInstances: 3, timeoutSeconds: 60, memory: '256MiB' };

exports.getOvhMailConfig = onCall(options, request => service.getConfig(request));
exports.saveOvhMailConfig = onCall(options, request => service.saveConfig(request));
exports.sendOvhNotification = onCall({ ...options, secrets: [smtpPassword] }, request => service.send(request));

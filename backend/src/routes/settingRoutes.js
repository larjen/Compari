/**
 * @module SettingRoutes
 * @description Express Router for Application Settings endpoints.
 * 
 * @responsibility
 * - Defines HTTP routes for settings endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * - Applies middleware (e.g., upload middleware).
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to SettingController).
 * - ❌ MUST NOT contain business logic (delegated to Services/Config).
 */

const express = require('express');
const router = express.Router();

const { settingController } = require('../config/container').getContainer();

router.get('/', settingController.getAllSettings);

router.post('/', settingController.updateSetting);

router.post('/test-ai', settingController.testAiConnectivity);

module.exports = router;
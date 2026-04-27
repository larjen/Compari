const express = require('express');
const router = express.Router();

module.exports = (container) => {
    const controller = container.resolve('reasoningController');
    router.post('/ask', controller.ask.bind(controller));
    router.get('/history', controller.getHistory.bind(controller));
    router.delete('/history', controller.clearHistory.bind(controller));
    return router;
};
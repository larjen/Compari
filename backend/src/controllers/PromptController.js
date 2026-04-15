const promptRepo = require('../repositories/PromptRepo');

class PromptController {
    static getPrompts(req, res, next) {
        try {
            const prompts = promptRepo.getAllPrompts();
            res.json({ prompts });
        } catch (error) {
            next(error);
        }
    }

    static updatePrompt(req, res, next) {
        try {
            const { id } = req.params;
            const { prompt } = req.body;
            
            if (!prompt) {
                return res.status(400).json({ error: 'Prompt content is required' });
            }

            const success = promptRepo.updatePrompt(Number(id), prompt);
            if (!success) {
                return res.status(404).json({ error: 'Prompt not found' });
            }

            const updatedPrompt = promptRepo.getPromptById(Number(id));
            res.json({ prompt: updatedPrompt });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = PromptController;
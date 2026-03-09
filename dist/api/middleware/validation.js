"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
exports.validatePagination = validatePagination;
function validate(schema) {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const messages = error.details.map(d => d.message).join('; ');
            return res.status(400).json({ error: 'Validation failed', details: messages });
        }
        next();
    };
}
function validatePagination(req, res, next) {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    if (limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'Limit must be between 1 and 100' });
    }
    if (offset < 0 || offset > 10000) {
        return res.status(400).json({ error: 'Offset must be between 0 and 10000' });
    }
    req.query.limit = limit.toString();
    req.query.offset = offset.toString();
    next();
}
//# sourceMappingURL=validation.js.map
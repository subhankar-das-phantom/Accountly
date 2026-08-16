const fieldService = require('../services/contributorFieldService');

const getFields = async (req, res, next) => {
  try {
    const result = await fieldService.getFields(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const addField = async (req, res, next) => {
  try {
    const result = await fieldService.addField(req.user, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const updateField = async (req, res, next) => {
  try {
    const result = await fieldService.updateField(req.user, req.params.id, req.params.key, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const deleteField = async (req, res, next) => {
  try {
    const result = await fieldService.deleteField(req.user, req.params.id, req.params.key);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFields,
  addField,
  updateField,
  deleteField
};

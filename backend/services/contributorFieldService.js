const Organization = require('../models/organization.model');

const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype', '$where', 'name'];

const validateFieldKey = (key) => {
  if (!key || typeof key !== 'string') throw new Error('Invalid key');
  if (key.length > 40) throw new Error('Key length exceeds 40 characters');
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) throw new Error('Key must start with a letter and contain only alphanumeric characters and underscores');
  if (DANGEROUS_KEYS.includes(key)) throw new Error('Key is reserved or unsafe');
};

const validateFieldConfig = (fieldData) => {
  const { key, label, type, options, required, publicVisibility, order } = fieldData;
  
  validateFieldKey(key);

  if (!label || label.length > 50) throw new Error('Label is required and must not exceed 50 characters');
  
  const allowedTypes = ['text', 'select', 'number'];
  if (!allowedTypes.includes(type)) throw new Error('Invalid field type');

  if (type === 'select') {
    if (!Array.isArray(options) || options.length === 0) throw new Error('Select fields must have options');
    if (options.length > 50) throw new Error('Too many options (max 50)');
    for (const opt of options) {
      if (typeof opt !== 'string' || opt.length > 100) {
        throw new Error('Invalid option string or option exceeds 100 characters');
      }
    }
  }

  const visibility = ['visible', 'hidden'].includes(publicVisibility) ? publicVisibility : 'visible';
  const isRequired = Boolean(required);
  const fieldOrder = Number.isInteger(order) ? order : 0;

  return {
    key,
    label,
    type,
    required: isRequired,
    publicVisibility: visibility,
    options: type === 'select' ? options : [],
    order: fieldOrder
  };
};

const getFields = async (userId, orgId) => {
  const org = await Organization.findOne({ _id: orgId, owner: userId }).lean();
  if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });
  return org.contributorFields || [];
};

const addField = async (userId, orgId, fieldData) => {
  const org = await Organization.findOne({ _id: orgId, owner: userId });
  if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });

  if (!org.contributorFields) org.contributorFields = [];
  if (org.contributorFields.length >= 20) {
    throw Object.assign(new Error('Maximum number of contributor fields (20) reached'), { status: 400 });
  }

  const validField = validateFieldConfig(fieldData);

  if (org.contributorFields.some(f => f.key === validField.key)) {
    throw Object.assign(new Error('Field key already exists'), { status: 400 });
  }

  org.contributorFields.push(validField);
  await org.save();
  return org.contributorFields;
};

const updateField = async (userId, orgId, fieldKey, fieldData) => {
  const org = await Organization.findOne({ _id: orgId, owner: userId });
  if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });
  
  if (!org.contributorFields) org.contributorFields = [];
  const fieldIndex = org.contributorFields.findIndex(f => f.key === fieldKey);
  if (fieldIndex === -1) throw Object.assign(new Error('Field not found'), { status: 404 });

  // Disallow key changes
  fieldData.key = fieldKey;
  const validField = validateFieldConfig(fieldData);

  org.contributorFields[fieldIndex] = validField;
  await org.save();
  return org.contributorFields;
};

const deleteField = async (userId, orgId, fieldKey) => {
  const org = await Organization.findOne({ _id: orgId, owner: userId });
  if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });

  if (!org.contributorFields) org.contributorFields = [];
  org.contributorFields = org.contributorFields.filter(f => f.key !== fieldKey);
  
  await org.save();
  return org.contributorFields;
};

module.exports = {
  getFields,
  addField,
  updateField,
  deleteField
};

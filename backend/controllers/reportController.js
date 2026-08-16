const PDFDocument = require('pdfkit');
const Transaction = require('../models/transaction.model');
const Organization = require('../models/organization.model');
const analyticsService = require('../services/analyticsService');
const reportService = require('../services/reportService');

const getReportData = async (organizationId) => {
  const org = await Organization.findById(organizationId);
  if (!org) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }
  
  const transactions = await Transaction.find({ organizationId }).sort({ date: -1 });
  if (transactions.length === 0) {
    const error = new Error('No transactions found for report generation');
    error.status = 404;
    throw error;
  }

  const userCurrency = org.currency || { code: 'USD', locale: 'en-US' };
  const analytics = await analyticsService.getAnalytics(organizationId, { periodType: 'all' });
  
  return { org, transactions, analytics, userCurrency };
};

const generatePdfReport = async (req, res, next) => {
  try {
    const organizationId = req.params.id;
    const { org, transactions, analytics, userCurrency } = await getReportData(organizationId);
    
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Transparency_Report_${org.slug}_${new Date().toISOString().split('T')[0]}.pdf"`);
    
    doc.pipe(res);
    await reportService.generatePDFReport(doc, transactions, analytics, userCurrency, organizationId);
    doc.end();
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: err.message });
    next(err);
  }
};

const generateExcelReport = async (req, res, next) => {
  try {
    const organizationId = req.params.id;
    const { org, transactions, analytics, userCurrency } = await getReportData(organizationId);
    
    const buffer = await reportService.generateExcelReport(transactions, analytics, userCurrency, organizationId);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Transparency_Report_${org.slug}_${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    res.send(buffer);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: err.message });
    next(err);
  }
};

module.exports = {
  generatePdfReport,
  generateExcelReport
};

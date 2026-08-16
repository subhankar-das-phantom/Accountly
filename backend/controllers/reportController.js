const PDFDocument = require('pdfkit');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const { calculateFinancialStats } = require('../services/analyticsService');
const reportService = require('../services/reportService');

const generateReport = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);
    const transactions = await Transaction.find({ user: req.user }).sort({ date: -1 });
    
    if (transactions.length === 0) {
      const error = new Error('No transactions found for report generation');
      error.status = 404;
      throw error;
    }

    // Get user currency preferences (default to INR if not set)
    const userCurrency = user?.currency || { code: 'INR', locale: 'en-IN' };

    // Calculate comprehensive statistics
    const stats = calculateFinancialStats(transactions);
    
    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Financial_Report_${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Generate PDF content with user's currency
    await reportService.generatePDFReport(doc, transactions, stats, userCurrency);
    
    // Finalize PDF
    doc.end();
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
};

module.exports = {
  generateReport
};

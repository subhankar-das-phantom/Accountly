// setup_demo_counter.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');
const DistributionCampaign = require('../models/distributionCampaign.model');
const DistributionRecord = require('../models/distributionRecord.model');
const Transaction = require('../models/transaction.model');

async function main() {
  await mongoose.connect(process.env.ATLAS_URI);
  console.log('Connected to MongoDB');

  const username = 'counter_admin';
  const email = 'counter_admin@accountly.local';
  const password = 'Password123!';

  let user = await User.findOne({ email });
  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user = await User.create({
      username,
      email,
      password: hashedPassword,
      currency: { code: 'INR', locale: 'en-IN' }
    });
  }

  let org = await Organization.findOne({ slug: 'counter-demo-org' });
  if (!org) {
    org = await Organization.create({
      name: 'Counter Demo Organization',
      slug: 'counter-demo-org',
      owner: user._id,
      currency: { code: 'INR', locale: 'en-IN' }
    });
  }

  let member = await OrganizationMember.findOne({ organizationId: org._id, userId: user._id });
  if (!member) {
    member = await OrganizationMember.create({
      organizationId: org._id,
      userId: user._id,
      role: 'OWNER',
      status: 'ACTIVE'
    });
  }

  let campaign = await DistributionCampaign.findOne({ organizationId: org._id, name: 'Tiffin Distribution 2026' });
  if (!campaign) {
    campaign = await DistributionCampaign.create({
      organizationId: org._id,
      name: 'Tiffin Distribution 2026',
      itemName: 'Tiffin Packet',
      description: 'Physical event food distribution counter',
      createdBy: user._id,
      status: 'ACTIVE'
    });

    const sampleContributors = [
      { name: 'ABC Contributor', roll: 'CSE-3A-01', amount: 150 },
      { name: 'Subhankar Das', roll: 'ECE-3B-12', amount: 200 },
      { name: 'Rohit Sharma', roll: 'ME-4A-45', amount: 100 },
      { name: 'Priya Patel', roll: 'IT-2B-08', amount: 250 },
      { name: 'Amit Kumar', roll: 'EE-3A-22', amount: 150 },
      { name: 'Ananya Roy', roll: 'CSE-4B-33', amount: 300 },
      { name: 'Vikram Malhotra', roll: 'CE-2A-14', amount: 100 },
      { name: 'Sneha Reddy', roll: 'AI-1A-05', amount: 200 }
    ];

    for (const c of sampleContributors) {
      const tx = await Transaction.create({
        organizationId: org._id,
        createdBy: user._id,
        type: 'contribution',
        amount: c.amount,
        category: 'Fest',
        date: new Date(),
        status: 'received',
        contributor: {
          name: c.name,
          metadata: new Map([['roll', c.roll]])
        }
      });

      await DistributionRecord.create({
        organizationId: org._id,
        campaignId: campaign._id,
        contributionId: tx._id,
        contributor: {
          name: c.name,
          metadata: tx.contributor.metadata
        },
        status: 'PENDING'
      });
    }
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  console.log('\n--- DEMO SETUP COMPLETED ---');
  console.log('Username:', username);
  console.log('Password:', password);
  console.log('Token:', token);
  console.log('Organization ID:', org._id.toString());
  console.log('Campaign ID:', campaign._id.toString());
  console.log('-----------------------------\n');

  await mongoose.disconnect();
}

main().catch(console.error);

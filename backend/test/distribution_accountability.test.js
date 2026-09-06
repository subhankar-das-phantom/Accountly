// distribution_accountability.test.js
// Comprehensive End-to-End Verification Suite for Step 12:
// Distribution Accountability, Operator Activity Analytics & Recipient History

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');

const DistributionCampaign = require('../models/distributionCampaign.model');
const DistributionRecord = require('../models/distributionRecord.model');
const DistributionActivity = require('../models/distributionActivity.model');
const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');

const TEST_PORT = 5056;
let server;
let baseUrl;

// State
let org1, org2;
let userAdmin, userOpRahul, userOpPriya, userOpAmit, userOrg2Admin;
let tokenAdmin, tokenRahul, tokenPriya, tokenAmit, tokenOrg2Admin;
let campaign1, campaignOrg2;
let memberRahul, memberPriya, memberAmit;
let suffix;

const request = (method, path, body = null, token = null, orgId = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (orgId) headers['X-Organization-Id'] = orgId.toString();

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          if (data && data.trim()) json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          body: json
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

async function setup() {
  console.log('\n======================================================');
  console.log('SETTING UP STEP 12 ACCOUNTABILITY TEST SUITE');
  console.log('======================================================');

  if (mongoose.connection.readyState !== 1) {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.ATLAS_URI);
    } else {
      await new Promise((resolve, reject) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', reject);
      });
    }
  }

  server = http.createServer(app);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  baseUrl = `http://localhost:${TEST_PORT}`;
  console.log(`Test server running at ${baseUrl}`);

  suffix = Date.now().toString().slice(-6);

  // Users
  userAdmin = await User.create({ username: `Admin_${suffix}`, email: `admin_${suffix}@test.com`, password: 'Password123!' });
  userOpRahul = await User.create({ username: `Rahul_${suffix}`, email: `rahul_${suffix}@test.com`, password: 'Password123!' });
  userOpPriya = await User.create({ username: `Priya_${suffix}`, email: `priya_${suffix}@test.com`, password: 'Password123!' });
  userOpAmit = await User.create({ username: `Amit_${suffix}`, email: `amit_${suffix}@test.com`, password: 'Password123!' });
  userOrg2Admin = await User.create({ username: `Org2Admin_${suffix}`, email: `org2_${suffix}@test.com`, password: 'Password123!' });

  tokenAdmin = jwt.sign({ id: userAdmin._id }, process.env.JWT_SECRET);
  tokenRahul = jwt.sign({ id: userOpRahul._id }, process.env.JWT_SECRET);
  tokenPriya = jwt.sign({ id: userOpPriya._id }, process.env.JWT_SECRET);
  tokenAmit = jwt.sign({ id: userOpAmit._id }, process.env.JWT_SECRET);
  tokenOrg2Admin = jwt.sign({ id: userOrg2Admin._id }, process.env.JWT_SECRET);

  // Orgs
  org1 = await Organization.create({
    name: `Fest Committee ${suffix}`,
    slug: `fest-comm-${suffix}`,
    owner: userAdmin._id,
    currency: { code: 'INR', symbol: '₹' }
  });

  org2 = await Organization.create({
    name: `Other Org ${suffix}`,
    slug: `other-org-${suffix}`,
    owner: userOrg2Admin._id,
    currency: { code: 'INR', symbol: '₹' }
  });

  // Memberships
  await OrganizationMember.create({ organizationId: org1._id, userId: userAdmin._id, role: 'OWNER', status: 'ACTIVE' });
  memberRahul = await OrganizationMember.create({ organizationId: org1._id, userId: userOpRahul._id, role: 'DISTRIBUTION_OPERATOR', status: 'ACTIVE' });
  memberPriya = await OrganizationMember.create({ organizationId: org1._id, userId: userOpPriya._id, role: 'DISTRIBUTION_OPERATOR', status: 'ACTIVE' });
  memberAmit = await OrganizationMember.create({ organizationId: org1._id, userId: userOpAmit._id, role: 'DISTRIBUTION_OPERATOR', status: 'ACTIVE' });
  await OrganizationMember.create({ organizationId: org2._id, userId: userOrg2Admin._id, role: 'OWNER', status: 'ACTIVE' });

  // Campaigns
  campaign1 = await DistributionCampaign.create({
    organizationId: org1._id,
    name: `Annual Fest Meal Distribution ${suffix}`,
    itemName: 'Tiffin Packet',
    description: 'Food distribution counter',
    createdBy: userAdmin._id,
    status: 'ACTIVE'
  });

  campaignOrg2 = await DistributionCampaign.create({
    organizationId: org2._id,
    name: `Org 2 Campaign ${suffix}`,
    itemName: 'Org 2 Kit',
    description: 'Org 2 Kit Counter',
    createdBy: userOrg2Admin._id,
    status: 'ACTIVE'
  });

  console.log('Setup completed successfully.');
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  const assert = (condition, title) => {
    if (condition) {
      console.log(`  ✓ PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${title}`);
      failed++;
    }
  };

  try {
    await setup();

    // =========================================================================
    // TEST 1: Role Enforcement & Permissions
    // =========================================================================
    console.log('\n--- TEST 1: Role Enforcement for DISTRIBUTION_OPERATOR ---');
    
    // Operator can read campaigns
    const resOpCamp = await request('GET', '/api/distributions/campaigns', null, tokenRahul, org1._id);
    assert(resOpCamp.status === 200 && Array.isArray(resOpCamp.body), 'Distribution Operator can fetch campaigns');

    // Operator CANNOT create campaigns
    const resOpCreateCamp = await request('POST', '/api/distributions/campaigns', { name: 'Hack', itemName: 'Bad' }, tokenRahul, org1._id);
    assert(resOpCreateCamp.status === 403, 'Distribution Operator is FORBIDDEN from creating campaigns (403)');

    // Operator CANNOT access financial transactions
    const resOpTx = await request('GET', '/api/transactions', null, tokenRahul, org1._id);
    assert(resOpTx.status === 403, 'Distribution Operator is FORBIDDEN from accessing financial transactions (403)');

    // Operator CANNOT access admin distribution analytics
    const resOpAnalytics = await request('GET', '/api/distributions/analytics/summary', null, tokenRahul, org1._id);
    assert(resOpAnalytics.status === 403, 'Distribution Operator is FORBIDDEN from accessing admin distribution analytics (403)');

    // Operator CANNOT manage members
    const resOpMember = await request('POST', `/api/organizations/${org1._id}/members`, { email: 'fake@test.com', role: 'ADMIN' }, tokenRahul, org1._id);
    assert(resOpMember.status === 403, 'Distribution Operator is FORBIDDEN from managing organization members (403)');

    // =========================================================================
    // TEST 2: Recipient Persistence & Traceability with Concurrency
    // =========================================================================
    console.log('\n--- TEST 2: Recipient Persistence & Atomic Concurrency ---');

    // Create 1 test contribution and distribution record
    const testTx1 = await Transaction.create({
      organizationId: org1._id,
      createdBy: userAdmin._id,
      type: 'contribution',
      amount: 500,
      category: 'Fest',
      date: new Date(),
      status: 'received',
      contributor: {
        name: 'Subhankar Das',
        metadata: new Map([['dept', 'CSE'], ['roll', '42'], ['section', 'A']])
      }
    });

    const record1 = await DistributionRecord.create({
      organizationId: org1._id,
      campaignId: campaign1._id,
      contributionId: testTx1._id,
      contributor: {
        name: 'Subhankar Das',
        metadata: testTx1.contributor.metadata
      },
      item: campaign1.itemName,
      quantity: 1,
      status: 'PENDING'
    });

    // 10 simultaneous distribution requests by Operator Rahul and Operator Priya
    const concurrencyPromises = [];
    for (let i = 0; i < 10; i++) {
      const token = i % 2 === 0 ? tokenRahul : tokenPriya;
      concurrencyPromises.push(
        request('POST', `/api/distributions/campaigns/${campaign1._id}/records/${record1._id}/distribute`, {}, token, org1._id)
      );
    }

    const concurrencyResults = await Promise.all(concurrencyPromises);
    const successes = concurrencyResults.filter(r => r.status === 200);
    const conflicts = concurrencyResults.filter(r => r.status === 409 && r.body?.code === 'ALREADY_DISTRIBUTED');

    assert(successes.length === 1, `Exactly 1 request succeeded under concurrency (got ${successes.length})`);
    assert(conflicts.length === 9, `Remaining 9 requests returned 409 ALREADY_DISTRIBUTED (got ${conflicts.length})`);

    // Verify recipient & operator persistence in authoritative DistributionRecord
    const savedRecord = await DistributionRecord.findById(record1._id).populate('distributedBy', 'username');
    assert(savedRecord.status === 'DISTRIBUTED', 'Authoritative record has status DISTRIBUTED');
    assert(savedRecord.contributor.name === 'Subhankar Das', 'Recipient name is Subhankar Das');
    assert(savedRecord.item === 'Tiffin Packet', 'Item is recorded as Tiffin Packet');
    assert(savedRecord.quantity === 1, 'Quantity is 1');
    assert(Boolean(savedRecord.distributedBy?.username), `Distributed by authenticated operator: ${savedRecord.distributedBy?.username}`);
    assert(Boolean(savedRecord.distributedAt), 'DistributedAt timestamp is recorded');

    // Verify companion DistributionActivity projection
    const savedActivity = await DistributionActivity.findOne({ recordId: record1._id });
    assert(Boolean(savedActivity), 'Companion DistributionActivity projection was created');
    assert(savedActivity.recipient.name === 'Subhankar Das', 'Activity projection contains recipient name');
    assert(savedActivity.item === 'Tiffin Packet', 'Activity projection contains item');
    assert(savedActivity.status === 'DISTRIBUTED', 'Activity status is DISTRIBUTED');
    assert(savedActivity.operator.username === savedRecord.distributedBy.username, 'Activity operator matches authoritative distributedBy');

    // =========================================================================
    // TEST 3: Organization Isolation
    // =========================================================================
    console.log('\n--- TEST 3: Organization Isolation ---');
    const resCrossOrg = await request('GET', `/api/distributions/campaigns/${campaign1._id}/records`, null, tokenOrg2Admin, org2._id);
    assert(resCrossOrg.status === 404 || resCrossOrg.body?.records?.length === 0, 'Org 2 admin cannot access Org 1 campaign records');

    const resCrossAnalytics = await request('GET', `/api/distributions/analytics/summary?campaignId=${campaign1._id}`, null, tokenOrg2Admin, org2._id);
    assert(resCrossAnalytics.body?.distributedCount === 0, 'Org 2 admin receives isolated 0 counts for Org 1 campaign');

    // =========================================================================
    // TEST 4: Deactivated Operator Enforcement
    // =========================================================================
    console.log('\n--- TEST 4: Deactivated Operator Protection ---');
    
    // Create record for Amit
    const testTx2 = await Transaction.create({
      organizationId: org1._id,
      createdBy: userAdmin._id,
      type: 'contribution',
      amount: 300,
      category: 'Fest',
      date: new Date(),
      status: 'received',
      contributor: { name: 'Priya Sharma' }
    });
    const record2 = await DistributionRecord.create({
      organizationId: org1._id,
      campaignId: campaign1._id,
      contributionId: testTx2._id,
      contributor: { name: 'Priya Sharma' },
      item: campaign1.itemName,
      quantity: 1,
      status: 'PENDING'
    });

    // Admin deactivates Amit
    const resDeact = await request('PATCH', `/api/distributions/operators/${memberAmit._id}/status`, { status: 'INACTIVE' }, tokenAdmin, org1._id);
    assert(resDeact.status === 200 && resDeact.body?.status === 'INACTIVE', 'Admin can deactivate operator membership');

    // Deactivated Amit attempts distribution
    const resAmitDist = await request('POST', `/api/distributions/campaigns/${campaign1._id}/records/${record2._id}/distribute`, {}, tokenAmit, org1._id);
    assert(resAmitDist.status === 403, 'Deactivated operator is rejected with 403 Forbidden');

    // Admin reactivates Amit
    const resReact = await request('PATCH', `/api/distributions/operators/${memberAmit._id}/status`, { status: 'ACTIVE' }, tokenAdmin, org1._id);
    assert(resReact.status === 200 && resReact.body?.status === 'ACTIVE', 'Admin can reactivate operator membership');

    // Reactivated Amit can now distribute
    const resAmitDist2 = await request('POST', `/api/distributions/campaigns/${campaign1._id}/records/${record2._id}/distribute`, {}, tokenAmit, org1._id);
    assert(resAmitDist2.status === 200, 'Reactivated operator successfully distributes');

    // =========================================================================
    // TEST 5: Reversal Accountability & Non-Destructive Event History
    // =========================================================================
    console.log('\n--- TEST 5: Reversal Accountability & Non-Destructive Projection ---');
    
    // Operator Rahul CANNOT undo
    const resOpUndo = await request('POST', `/api/distributions/campaigns/${campaign1._id}/records/${record2._id}/undo`, { reason: 'Wrong person' }, tokenRahul, org1._id);
    assert(resOpUndo.status === 403, 'Operator is FORBIDDEN from undoing distributions (403)');

    // Admin undoes record2
    const resAdminUndo = await request('POST', `/api/distributions/campaigns/${campaign1._id}/records/${record2._id}/undo`, { reason: 'Accidental click' }, tokenAdmin, org1._id);
    assert(resAdminUndo.status === 200, 'Admin successfully undoes distribution');

    // Verify DistributionRecord status reverted to PENDING with reversal audit
    const reversedRecord = await DistributionRecord.findById(record2._id);
    assert(reversedRecord.status === 'PENDING', 'Authoritative record reverted to PENDING');
    assert(Boolean(reversedRecord.reversedAt), 'Reversal timestamp recorded');
    assert(reversedRecord.reversalReason === 'Accidental click', 'Reversal reason recorded');

    // Verify companion DistributionActivity was NOT deleted, but transitioned status to REVERSED
    const activityReversed = await DistributionActivity.findOne({ recordId: record2._id });
    assert(Boolean(activityReversed), 'Historical activity record was NOT deleted');
    assert(activityReversed.status === 'REVERSED', 'Activity status transitioned to REVERSED');
    assert(activityReversed.operator.username === userOpAmit.username, 'Original operator Amit preserved');
    assert(activityReversed.recipient.name === 'Priya Sharma', 'Original recipient Priya Sharma preserved');
    assert(activityReversed.reversal.reason === 'Accidental click', 'Reversal reason preserved in activity');

    // =========================================================================
    // TEST 6: The 34-Distribution Concrete Traceability Scenario
    // =========================================================================
    console.log('\n--- TEST 6: 120 Eligible Participants -> 34 Distributions Traceability ---');

    // Create fresh campaign with 120 participants
    const festCampaign = await DistributionCampaign.create({
      organizationId: org1._id,
      name: `Grand Fest Distribution ${suffix}`,
      itemName: 'Dinner Thali',
      createdBy: userAdmin._id,
      status: 'ACTIVE'
    });

    const participantRecords = [];
    for (let i = 1; i <= 120; i++) {
      const dept = i % 3 === 0 ? 'CSE' : (i % 3 === 1 ? 'ECE' : 'ME');
      const section = i % 2 === 0 ? 'A' : 'B';
      const tx = await Transaction.create({
        organizationId: org1._id,
        createdBy: userAdmin._id,
        type: 'contribution',
        amount: 250,
        category: 'Fest',
        date: new Date(),
        status: 'received',
        contributor: {
          name: `Participant ${i}`,
          metadata: new Map([['dept', dept], ['section', section], ['roll', `${i}`]])
        }
      });

      const rec = await DistributionRecord.create({
        organizationId: org1._id,
        campaignId: festCampaign._id,
        contributionId: tx._id,
        contributor: {
          name: `Participant ${i}`,
          metadata: tx.contributor.metadata
        },
        item: 'Dinner Thali',
        quantity: 1,
        status: 'PENDING'
      });
      participantRecords.push(rec);
    }

    // Perform 34 distributions:
    // Rahul distributes 15 (indices 0..14)
    // Priya distributes 11 (indices 15..25)
    // Amit distributes 8   (indices 26..33)
    for (let i = 0; i < 15; i++) {
      await request('POST', `/api/distributions/campaigns/${festCampaign._id}/records/${participantRecords[i]._id}/distribute`, {}, tokenRahul, org1._id);
    }
    for (let i = 15; i < 26; i++) {
      await request('POST', `/api/distributions/campaigns/${festCampaign._id}/records/${participantRecords[i]._id}/distribute`, {}, tokenPriya, org1._id);
    }
    for (let i = 26; i < 34; i++) {
      await request('POST', `/api/distributions/campaigns/${festCampaign._id}/records/${participantRecords[i]._id}/distribute`, {}, tokenAmit, org1._id);
    }

    // Admin verifies KPI Summary
    const resSummary = await request('GET', `/api/distributions/analytics/summary?campaignId=${festCampaign._id}`, null, tokenAdmin, org1._id);
    assert(resSummary.status === 200, 'Admin can fetch analytics summary');
    assert(resSummary.body.eligibleCount === 120, `Eligible count is 120 (got ${resSummary.body.eligibleCount})`);
    assert(resSummary.body.distributedCount === 34, `Distributed count is 34 (got ${resSummary.body.distributedCount})`);
    assert(resSummary.body.pendingCount === 86, `Pending count is 86 (got ${resSummary.body.pendingCount})`);
    assert(resSummary.body.totalQuantityDistributed === 34, `Total quantity distributed is 34 (got ${resSummary.body.totalQuantityDistributed})`);

    // Admin verifies Operator Breakdown
    const resOps = await request('GET', `/api/distributions/analytics/operators?campaignId=${festCampaign._id}`, null, tokenAdmin, org1._id);
    assert(resOps.status === 200 && Array.isArray(resOps.body), 'Admin can fetch operator analytics breakdown');
    
    const rahulStat = resOps.body.find(o => o.operator.username === userOpRahul.username);
    const priyaStat = resOps.body.find(o => o.operator.username === userOpPriya.username);
    const amitStat = resOps.body.find(o => o.operator.username === userOpAmit.username);

    assert(rahulStat?.distributedCount === 15, `Rahul distributed count is 15 (got ${rahulStat?.distributedCount})`);
    assert(priyaStat?.distributedCount === 11, `Priya distributed count is 11 (got ${priyaStat?.distributedCount})`);
    assert(amitStat?.distributedCount === 8, `Amit distributed count is 8 (got ${amitStat?.distributedCount})`);
    assert(
      (rahulStat?.distributedCount || 0) + (priyaStat?.distributedCount || 0) + (amitStat?.distributedCount || 0) === 34,
      'Sum of operator distributions equals total successful distributions (34)'
    );

    // TRACEABILITY CHECK: Admin expands Rahul's 15 distributions
    const resRahulHistory = await request(
      'GET',
      `/api/distributions/analytics/operators/${userOpRahul._id}/history?campaignId=${festCampaign._id}&pageSize=50`,
      null,
      tokenAdmin,
      org1._id
    );

    assert(resRahulHistory.status === 200, 'Admin can expand operator detail history');
    assert(resRahulHistory.body.records.length === 15, `Rahul drilldown returns the EXACT 15 recipients (got ${resRahulHistory.body.records.length})`);
    
    // Verify each recipient record contains required accountability fields
    const firstRahulRec = resRahulHistory.body.records[0];
    assert(Boolean(firstRahulRec.recipient?.name), `Recipient name is visible: ${firstRahulRec.recipient?.name}`);
    assert(firstRahulRec.item === 'Dinner Thali', `Item is Dinner Thali: ${firstRahulRec.item}`);
    assert(firstRahulRec.quantity === 1, `Quantity is 1: ${firstRahulRec.quantity}`);
    assert(Boolean(firstRahulRec.distributedAt), `Timestamp is recorded: ${firstRahulRec.distributedAt}`);
    assert(firstRahulRec.status === 'DISTRIBUTED', `Status is DISTRIBUTED`);

    // RECIPIENT HISTORY CHECK: Admin inspects Participant 1
    const resRecipientHist = await request(
      'GET',
      `/api/distributions/analytics/recipients/history?recipientName=Participant 1`,
      null,
      tokenAdmin,
      org1._id
    );
    assert(resRecipientHist.status === 200, 'Admin can look up recipient history');
    assert(resRecipientHist.body.recipient?.name === 'Participant 1', 'Found Participant 1');
    assert(resRecipientHist.body.history.length === 1, 'Participant 1 has 1 distribution history item');
    assert(resRecipientHist.body.history[0].item === 'Dinner Thali', 'Item received was Dinner Thali');
    assert(resRecipientHist.body.history[0].operator.username === userOpRahul.username, `Distributed by Rahul: ${resRecipientHist.body.history[0].operator.username}`);

    // ACTIVITY FEED FILTERING CHECK: Admin filters by operator Rahul
    const resActivityFeed = await request(
      'GET',
      `/api/distributions/analytics/activity?campaignId=${festCampaign._id}&operatorId=${userOpRahul._id}&pageSize=50`,
      null,
      tokenAdmin,
      org1._id
    );
    assert(resActivityFeed.status === 200, 'Admin can filter activity log by operator');
    assert(resActivityFeed.body.records.length === 15, `Filtered activity feed returns 15 records for Rahul`);

    console.log('\n======================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();

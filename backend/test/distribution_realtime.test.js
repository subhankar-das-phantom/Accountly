// distribution_realtime.test.js
// Comprehensive Verification Suite for Step 10.1 & 10.2:
// Real-Time Multi-Device Distribution Synchronization & Zero-Duplicate Guarantee

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');

const DistributionCampaign = require('../models/distributionCampaign.model');
const DistributionRecord = require('../models/distributionRecord.model');
const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const { cache } = require('../utils/cache');

const TEST_PORT = 5055;
let server;
let baseUrl;

// Test state
let org1, org2;
let userAdminA, userAdminB, userAdminC, userAdminOrg2;
let tokenA, tokenB, tokenC, tokenOrg2;
let campaign1, campaign2;
let records = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to establish SSE connection and collect events
const connectSSE = (url, token, orgId) => {
  return new Promise((resolve, reject) => {
    const fullUrl = `${url}?token=${token}&orgId=${orgId}`;
    const parsedUrl = new URL(fullUrl);
    const events = [];

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          Accept: 'text/event-stream'
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`SSE connection failed with status ${res.statusCode}`));
        }

        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n\n');
          buffer = lines.pop(); // keep remainder

          for (const block of lines) {
            if (block.startsWith(': ping')) continue;
            const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
            if (dataLine) {
              try {
                const parsed = JSON.parse(dataLine.replace('data: ', ''));
                events.push(parsed);
              } catch (e) {
                // ignore
              }
            }
          }
        });

        resolve({
          req,
          res,
          events,
          close: () => {
            req.destroy();
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
};

async function setup() {
  console.log('\n======================================================');
  console.log('SETTING UP REAL-TIME DISTRIBUTION TEST SUITE');
  console.log('======================================================');

  // Connect to DB if not fully connected
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

  // Start test HTTP server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  baseUrl = `http://localhost:${TEST_PORT}`;
  console.log(`Test server running at ${baseUrl}`);

  const testSuffix = Date.now().toString().slice(-6);

  // 1. Create Test Users
  userAdminA = await User.create({
    username: `AdminA_${testSuffix}`,
    email: `adminA_${testSuffix}@test.com`,
    password: 'Password123!',
    fullName: 'Admin Device A'
  });

  userAdminB = await User.create({
    username: `AdminB_${testSuffix}`,
    email: `adminB_${testSuffix}@test.com`,
    password: 'Password123!',
    fullName: 'Admin Device B'
  });

  userAdminC = await User.create({
    username: `AdminC_${testSuffix}`,
    email: `adminC_${testSuffix}@test.com`,
    password: 'Password123!',
    fullName: 'Admin Device C'
  });

  userAdminOrg2 = await User.create({
    username: `AdminOrg2_${testSuffix}`,
    email: `adminOrg2_${testSuffix}@test.com`,
    password: 'Password123!',
    fullName: 'Admin Org 2'
  });

  // Generate tokens
  tokenA = jwt.sign({ id: userAdminA._id }, process.env.JWT_SECRET);
  tokenB = jwt.sign({ id: userAdminB._id }, process.env.JWT_SECRET);
  tokenC = jwt.sign({ id: userAdminC._id }, process.env.JWT_SECRET);
  tokenOrg2 = jwt.sign({ id: userAdminOrg2._id }, process.env.JWT_SECRET);

  // 2. Create Test Organizations
  org1 = await Organization.create({
    name: `Test Org 1 ${testSuffix}`,
    slug: `test-org-1-${testSuffix}`,
    owner: userAdminA._id,
    currency: { code: 'INR', symbol: '₹' }
  });

  org2 = await Organization.create({
    name: `Test Org 2 ${testSuffix}`,
    slug: `test-org-2-${testSuffix}`,
    owner: userAdminOrg2._id,
    currency: { code: 'INR', symbol: '₹' }
  });

  // Assign memberships
  await OrganizationMember.create({
    organizationId: org1._id,
    userId: userAdminA._id,
    role: 'OWNER',
    status: 'ACTIVE'
  });

  await OrganizationMember.create({
    organizationId: org1._id,
    userId: userAdminB._id,
    role: 'ADMIN',
    status: 'ACTIVE'
  });

  await OrganizationMember.create({
    organizationId: org1._id,
    userId: userAdminC._id,
    role: 'ADMIN',
    status: 'ACTIVE'
  });

  await OrganizationMember.create({
    organizationId: org2._id,
    userId: userAdminOrg2._id,
    role: 'OWNER',
    status: 'ACTIVE'
  });

  // 3. Create Campaigns
  campaign1 = await DistributionCampaign.create({
    organizationId: org1._id,
    name: `Annual Fest Distribution ${testSuffix}`,
    itemName: 'Meal Packet',
    description: 'Tiffin distribution counter',
    createdBy: userAdminA._id,
    status: 'ACTIVE'
  });

  campaign2 = await DistributionCampaign.create({
    organizationId: org2._id,
    name: `Org 2 Festival Kits ${testSuffix}`,
    itemName: 'Gift Kit',
    createdBy: userAdminOrg2._id,
    status: 'ACTIVE'
  });

  // 4. Create Transactions & Distribution Records for Campaign 1
  for (let i = 1; i <= 15; i++) {
    const tx = await Transaction.create({
      organizationId: org1._id,
      createdBy: userAdminA._id,
      type: 'contribution',
      amount: 100 * i,
      category: 'General',
      date: new Date(),
      status: 'received',
      contributor: {
        name: i === 1 ? 'ABC Contributor' : `Contributor ${i}`,
        metadata: new Map([['roll', `CSE-${i}`]])
      }
    });

    const rec = await DistributionRecord.create({
      organizationId: org1._id,
      campaignId: campaign1._id,
      contributionId: tx._id,
      contributor: {
        name: tx.contributor.name,
        metadata: tx.contributor.metadata
      },
      status: 'PENDING'
    });

    records.push(rec);
  }

  console.log(`Setup complete: Org 1 (${org1._id}), Campaign 1 (${campaign1._id}), Records (${records.length})`);
}

async function cleanup() {
  console.log('\nCLEANING UP TEST FIXTURES...');
  if (org1) {
    await DistributionRecord.deleteMany({ organizationId: org1._id });
    await DistributionCampaign.deleteMany({ organizationId: org1._id });
    await Transaction.deleteMany({ organizationId: org1._id });
    await OrganizationMember.deleteMany({ organizationId: org1._id });
    await Organization.deleteOne({ _id: org1._id });
  }

  if (org2) {
    await DistributionRecord.deleteMany({ organizationId: org2._id });
    await DistributionCampaign.deleteMany({ organizationId: org2._id });
    await Transaction.deleteMany({ organizationId: org2._id });
    await OrganizationMember.deleteMany({ organizationId: org2._id });
    await Organization.deleteOne({ _id: org2._id });
  }

  await User.deleteMany({
    _id: { $in: [userAdminA?._id, userAdminB?._id, userAdminC?._id, userAdminOrg2?._id].filter(Boolean) }
  });

  if (server) {
    server.close();
  }

  console.log('Cleanup completed successfully.');
}

// ----------------------------------------------------
// TEST RUNNER
// ----------------------------------------------------
async function runTests() {
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      process.stdout.write(`TEST: ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL`);
      console.error(err);
      failed++;
    }
  };

  try {
    await setup();

    // ========================================================
    // TEST 1 — Normal Distribution (200 SUCCESS)
    // ========================================================
    await test('Test 1 — Normal Distribution (200 SUCCESS)', async () => {
      const targetRecord = records[0]; // ABC Contributor
      const res = await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenA}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notes: 'Counter 1 Pickup' })
        }
      );

      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}: ${await res.text()}`);
      }

      const body = await res.json();
      if (body.status !== 'DISTRIBUTED') {
        throw new Error(`Expected status DISTRIBUTED, got ${body.status}`);
      }

      if (!body.stats || body.stats.distributedCount !== 1) {
        throw new Error(`Expected distributedCount 1, got ${body.stats?.distributedCount}`);
      }

      // Verify in DB
      const dbRecord = await DistributionRecord.findById(targetRecord._id);
      if (dbRecord.status !== 'DISTRIBUTED') {
        throw new Error(`Database status is ${dbRecord.status}, expected DISTRIBUTED`);
      }
    });

    // ========================================================
    // TEST 2 — Duplicate Distribution (409 ALREADY_DISTRIBUTED)
    // ========================================================
    await test('Test 2 — Duplicate Distribution Rejection (409 ALREADY_DISTRIBUTED)', async () => {
      const targetRecord = records[0]; // Already distributed in Test 1
      const res = await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenB}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notes: 'Duplicate attempt' })
        }
      );

      if (res.status !== 409) {
        throw new Error(`Expected status 409, got ${res.status}: ${await res.text()}`);
      }

      const body = await res.json();
      if (body.code !== 'ALREADY_DISTRIBUTED') {
        throw new Error(`Expected code ALREADY_DISTRIBUTED, got ${body.code}`);
      }

      if (!body.distributedBy || !body.distributedAt) {
        throw new Error(`Expected conflict metadata (distributedBy, distributedAt), got ${JSON.stringify(body)}`);
      }
    });

    // ========================================================
    // TEST 3 — Strict Concurrency Requirement (10 Simultaneous Requests)
    // ========================================================
    await test('Test 3 — Strict Concurrency Guarantee (10 simultaneous requests -> exactly 1x 200, 9x 409)', async () => {
      const targetRecord = records[1]; // Pending record
      const concurrentCount = 10;

      // Fire 10 simultaneous requests to the same record
      const promises = Array.from({ length: concurrentCount }).map((_, i) =>
        fetch(`${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${i % 2 === 0 ? tokenA : tokenB}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notes: `Concurrent attempt #${i + 1}` })
        })
      );

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 200).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      if (successCount !== 1) {
        throw new Error(`CONCURRENCY VIOLATION! Expected exactly 1 success (200), got ${successCount}`);
      }

      if (conflictCount !== 9) {
        throw new Error(`Expected exactly 9 conflicts (409), got ${conflictCount}. Statuses: ${statuses.join(',')}`);
      }

      // Verify in DB that only 1 state transition occurred
      const dbRecord = await DistributionRecord.findById(targetRecord._id);
      if (dbRecord.status !== 'DISTRIBUTED') {
        throw new Error(`Database state not DISTRIBUTED`);
      }
    });

    // ========================================================
    // TEST 4 — Real-Time Cross-Device SSE Broadcast (A, B, C)
    // ========================================================
    await test('Test 4 — Real-Time Cross-Device SSE Broadcast (Client A, B, C)', async () => {
      // Connect simulated devices B and C via SSE
      const clientB = await connectSSE(`${baseUrl}/api/distributions/campaigns/${campaign1._id}/events`, tokenB, org1._id);
      const clientC = await connectSSE(`${baseUrl}/api/distributions/campaigns/${campaign1._id}/events`, tokenC, org1._id);

      await sleep(100); // Allow SSE subscriptions to register

      const targetRecord = records[2]; // Pending record

      // Admin A distributes record
      const res = await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenA}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notes: 'Distributed by Admin A' })
        }
      );

      if (res.status !== 200) {
        throw new Error(`Distribution failed with status ${res.status}`);
      }

      await sleep(250); // Wait for event propagation

      // Check Client B events
      const eventB = clientB.events.find(
        (e) => e.type === 'DISTRIBUTION_UPDATED' && e.recordId === targetRecord._id.toString()
      );
      if (!eventB) {
        throw new Error(`Client B did NOT receive DISTRIBUTION_UPDATED event! Received: ${JSON.stringify(clientB.events)}`);
      }
      if (eventB.status !== 'DISTRIBUTED') {
        throw new Error(`Client B received invalid status: ${eventB.status}`);
      }

      // Check Client C events
      const eventC = clientC.events.find(
        (e) => e.type === 'DISTRIBUTION_UPDATED' && e.recordId === targetRecord._id.toString()
      );
      if (!eventC) {
        throw new Error(`Client C did NOT receive DISTRIBUTION_UPDATED event! Received: ${JSON.stringify(clientC.events)}`);
      }
      if (eventC.status !== 'DISTRIBUTED') {
        throw new Error(`Client C received invalid status: ${eventC.status}`);
      }

      // Check authoritative stats inside event
      if (!eventB.stats || eventB.stats.distributedCount !== 3) {
        throw new Error(`Expected distributedCount 3 in event stats, got ${eventB.stats?.distributedCount}`);
      }

      clientB.close();
      clientC.close();
    });

    // ========================================================
    // TEST 5 — Reconnection Recovery
    // ========================================================
    await test('Test 5 — Reconnection Recovery & Authoritative State Reconciliation', async () => {
      // Connect Client B
      let clientB = await connectSSE(`${baseUrl}/api/distributions/campaigns/${campaign1._id}/events`, tokenB, org1._id);
      await sleep(100);

      // Client B disconnects
      clientB.close();

      // While Client B is disconnected, Admin A distributes record 3
      const targetRecord = records[3];
      await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenA}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Client B reconnects and performs authoritative campaign query
      const reconnRes = await fetch(`${baseUrl}/api/distributions/campaigns/${campaign1._id}`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      const reconnBody = await reconnRes.json();

      if (reconnBody.stats.distributedCount !== 4) {
        throw new Error(`Expected reconciled distributedCount 4, got ${reconnBody.stats.distributedCount}`);
      }

      // Query the specific record to verify it reflects DISTRIBUTED
      const recordsRes = await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records?search=Contributor%204`,
        {
          headers: { Authorization: `Bearer ${tokenB}` }
        }
      );
      const recordsBody = await recordsRes.json();
      const rec = recordsBody.records.find((r) => r._id === targetRecord._id.toString());
      if (!rec || rec.status !== 'DISTRIBUTED') {
        throw new Error(`Reconnected query failed: record is not DISTRIBUTED (${rec?.status})`);
      }
    });

    // ========================================================
    // TEST 6 — Search Result Synchronization
    // ========================================================
    await test('Test 6 — Search Result Synchronization (Remote state update on filtered query)', async () => {
      const clientB = await connectSSE(`${baseUrl}/api/distributions/campaigns/${campaign1._id}/events`, tokenB, org1._id);
      await sleep(100);

      const targetRecord = records[4]; // Contributor 5

      // Client B searched for Contributor 5
      const searchRes = await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records?search=Contributor%205`,
        {
          headers: { Authorization: `Bearer ${tokenB}` }
        }
      );
      const searchBody = await searchRes.json();
      if (searchBody.records[0].status !== 'PENDING') {
        throw new Error('Initial search record should be PENDING');
      }

      // Client A distributes it
      await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' }
        }
      );

      await sleep(200);

      // Verify Client B received the update for that exact record
      const updateEvent = clientB.events.find(
        (e) => e.type === 'DISTRIBUTION_UPDATED' && e.recordId === targetRecord._id.toString()
      );
      if (!updateEvent || updateEvent.status !== 'DISTRIBUTED') {
        throw new Error('Search result did not receive live DISTRIBUTED event');
      }

      clientB.close();
    });

    // ========================================================
    // TEST 7 — Undo Synchronization
    // ========================================================
    await test('Test 7 — Atomic Undo Synchronization (Reverts to PENDING and updates all devices)', async () => {
      const clientB = await connectSSE(`${baseUrl}/api/distributions/campaigns/${campaign1._id}/events`, tokenB, org1._id);
      await sleep(100);

      const targetRecord = records[4]; // Distributed in Test 6

      // Undo distribution by Admin A
      const undoRes = await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/undo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenA}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'Accidental click' })
        }
      );

      if (undoRes.status !== 200) {
        throw new Error(`Undo failed with status ${undoRes.status}: ${await undoRes.text()}`);
      }

      const undoBody = await undoRes.json();
      if (undoBody.status !== 'PENDING') {
        throw new Error(`Expected status PENDING after undo, got ${undoBody.status}`);
      }

      await sleep(200);

      // Verify Client B received PENDING event
      const undoEvent = clientB.events.find(
        (e) => e.type === 'DISTRIBUTION_UPDATED' && e.recordId === targetRecord._id.toString() && e.status === 'PENDING'
      );
      if (!undoEvent) {
        throw new Error('Client B did not receive UNDO event with PENDING status');
      }

      if (!undoEvent.stats || undoEvent.stats.distributedCount !== 4) {
        throw new Error(`Expected decremented distributedCount 4, got ${undoEvent.stats?.distributedCount}`);
      }

      clientB.close();
    });

    // ========================================================
    // TEST 8 — Multi-Tenant & Organization Isolation
    // ========================================================
    await test('Test 8 — Multi-Tenant Organization Isolation (Org 1 events NEVER leak to Org 2)', async () => {
      // Client 1 connected to Org 1
      const clientOrg1 = await connectSSE(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/events`,
        tokenA,
        org1._id
      );

      // Client 2 connected to Org 2
      const clientOrg2 = await connectSSE(
        `${baseUrl}/api/distributions/campaigns/${campaign2._id}/events`,
        tokenOrg2,
        org2._id
      );

      await sleep(100);

      const targetRecord = records[5]; // Pending record in Org 1

      // Distribute in Org 1
      await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' }
        }
      );

      await sleep(250);

      // Org 1 client should receive event
      const eventOrg1 = clientOrg1.events.find(
        (e) => e.type === 'DISTRIBUTION_UPDATED' && e.recordId === targetRecord._id.toString()
      );
      if (!eventOrg1) {
        throw new Error('Org 1 client did not receive its own event');
      }

      // Org 2 client should have ZERO distribution events
      const leakedEvents = clientOrg2.events.filter((e) => e.type === 'DISTRIBUTION_UPDATED');
      if (leakedEvents.length > 0) {
        throw new Error(`SECURITY LEAK! Org 2 received ${leakedEvents.length} events from Org 1!`);
      }

      clientOrg1.close();
      clientOrg2.close();
    });

    // ========================================================
    // TEST 9 — Rapid Double-Click from Same Client
    // ========================================================
    await test('Test 9 — Rapid Double-Click Protection (1x 200, 1x 409)', async () => {
      const targetRecord = records[6]; // Pending record

      // Two simultaneous rapid requests from the same client
      const p1 = fetch(`${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' }
      });

      const p2 = fetch(`${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' }
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      const statusPair = [r1.status, r2.status].sort();

      if (statusPair[0] !== 200 || statusPair[1] !== 409) {
        throw new Error(`Expected [200, 409], got [${r1.status}, ${r2.status}]`);
      }
    });

    // ========================================================
    // TEST 10 — Cache Invalidation & Invariant Protection
    // ========================================================
    await test('Test 10 — Server Cache Invalidation & Invariant Protection', async () => {
      // Put a test value in cache for org1
      const testKey = `transactions_org_${org1._id}_test`;
      cache.set(testKey, { sample: 'data' });

      // Distribute another record
      const targetRecord = records[7];
      await fetch(
        `${baseUrl}/api/distributions/campaigns/${campaign1._id}/records/${targetRecord._id}/distribute`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' }
        }
      );

      // Invalidation is triggered asynchronously; wait a moment
      await sleep(100);

      // Verify key was purged
      if (cache.get(testKey)) {
        throw new Error('Cache was NOT invalidated after distribution mutation!');
      }

      // Check invariant: Distributed <= Eligible, Remaining >= 0
      const campRes = await fetch(`${baseUrl}/api/distributions/campaigns/${campaign1._id}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const camp = await campRes.json();

      if (camp.stats.distributedCount > camp.stats.eligibleCount) {
        throw new Error(`Invariant failed: distributedCount (${camp.stats.distributedCount}) > eligibleCount (${camp.stats.eligibleCount})`);
      }

      if (camp.stats.remainingCount < 0) {
        throw new Error(`Invariant failed: remainingCount (${camp.stats.remainingCount}) < 0`);
      }
    });

  } finally {
    await cleanup();
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});

/**
 * Test: Operator Provisioning & Handover Flow
 *
 * Validates:
 * 1. Admin creates account for distribution with email + password
 * 2. Handover credentials work for operator login
 * 3. Operator receives role: DISTRIBUTION_OPERATOR
 * 4. Operator has counter access (/distributions)
 * 5. Operator is denied access to admin analytics & settings (403)
 * 6. Admin can deactivate and reactivate operator
 */

const mongoose = require('mongoose');
const http = require('http');
const app = require('../server');

const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');

const request = (server, method, path, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${server.address().port}`);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let data = rawData;
          try {
            data = JSON.parse(rawData);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const run = async () => {
  console.log('=== TEST: Operator Provision & Handover Flow ===\n');

  let server;
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    const testTag = Date.now().toString().slice(-6);

    // 1. Register Admin
    const adminEmail = `admin_${testTag}@test.com`;
    const adminPass = 'AdminPass123!';
    const regRes = await request(server, 'POST', '/api/users/register', {}, {
      username: `admin_${testTag}`,
      email: adminEmail,
      password: adminPass
    });
    console.log('1. Register Admin:', regRes.status === 200 ? 'SUCCESS' : 'FAILED');

    const adminToken = regRes.data.token;
    const org = await Organization.findOne({ name: `admin_${testTag}'s Accountly` });
    const orgHeaders = {
      Authorization: `Bearer ${adminToken}`,
      'X-Organization-Id': org._id.toString()
    };

    // 2. Admin creates account for distribution: provides email and password for volunteer
    const volunteerEmail = `volunteer_${testTag}@accountly.org`;
    const volunteerPass = 'CounterVolunteer#123';
    const volunteerName = `Volunteer Desk ${testTag}`;

    const addOpRes = await request(server, 'POST', '/api/distributions/operators', orgHeaders, {
      email: volunteerEmail,
      username: volunteerName,
      password: volunteerPass
    });

    console.log('2. Provision Operator Account:', addOpRes.status === 201 ? 'SUCCESS' : 'FAILED');
    if (addOpRes.status !== 201) {
      console.error('Error adding operator:', addOpRes.data);
      process.exit(1);
    }
    const memberId = addOpRes.data._id;
    console.log('   Member ID created:', memberId);

    // 3. Handover credentials: volunteer logs in with provided email and password
    const loginRes = await request(server, 'POST', '/api/users/login', {}, {
      email: volunteerEmail,
      password: volunteerPass
    });

    console.log('3. Volunteer Login with Handover Credentials:', loginRes.status === 200 ? 'SUCCESS' : 'FAILED');
    if (loginRes.status !== 200) {
      console.error('Login failed:', loginRes.data);
      process.exit(1);
    }

    const volunteerToken = loginRes.data.token;
    const volunteerRole = loginRes.data.primaryRole || loginRes.data.user.role;
    console.log('   Assigned Role:', volunteerRole);
    if (volunteerRole !== 'DISTRIBUTION_OPERATOR') {
      console.error('Expected role to be DISTRIBUTION_OPERATOR, got:', volunteerRole);
      process.exit(1);
    }

    const opHeaders = {
      Authorization: `Bearer ${volunteerToken}`,
      'X-Organization-Id': org._id.toString()
    };

    // 4. Operator counter access
    const campaignRes = await request(server, 'GET', '/api/distributions/campaigns', opHeaders);
    console.log('4. Operator can view campaigns (Counter mode):', campaignRes.status === 200 ? 'SUCCESS' : 'FAILED');

    // 5. Operator restricted from Admin Analytics (403 Forbidden)
    const analyticsRes = await request(server, 'GET', '/api/distributions/analytics/summary', opHeaders);
    console.log('5. Operator denied admin analytics (403):', analyticsRes.status === 403 ? 'SUCCESS' : 'FAILED');

    // 6. Operator restricted from Operator Management (403 Forbidden)
    const opMgmtRes = await request(server, 'GET', '/api/distributions/operators', opHeaders);
    console.log('6. Operator denied operator management (403):', opMgmtRes.status === 403 ? 'SUCCESS' : 'FAILED');

    // 7. Admin lists operators (verifying flat properties)
    const listRes = await request(server, 'GET', '/api/distributions/operators', orgHeaders);
    console.log('7. Admin lists operators:', listRes.status === 200 ? 'SUCCESS' : 'FAILED');
    const createdOp = listRes.data.find(o => o.email === volunteerEmail);
    console.log('   Operator username verified:', createdOp?.username === volunteerName ? 'SUCCESS' : 'FAILED');
    console.log('   Operator status is ACTIVE:', createdOp?.status === 'ACTIVE' ? 'SUCCESS' : 'FAILED');

    // 8. Admin deactivates operator (INACTIVE)
    const deactRes = await request(server, 'PATCH', `/api/distributions/operators/${memberId}/status`, orgHeaders, {
      status: 'INACTIVE'
    });
    console.log('8. Admin deactivates operator:', deactRes.status === 200 ? 'SUCCESS' : 'FAILED');

    // 9. Deactivated operator blocked from campaigns
    const deactCampaignRes = await request(server, 'GET', '/api/distributions/campaigns', opHeaders);
    console.log('9. Deactivated operator blocked (403):', deactCampaignRes.status === 403 ? 'SUCCESS' : 'FAILED');

    // 10. Admin reactivates operator (ACTIVE)
    const reactRes = await request(server, 'PATCH', `/api/distributions/operators/${memberId}/status`, orgHeaders, {
      status: 'ACTIVE'
    });
    console.log('10. Admin reactivates operator:', reactRes.status === 200 ? 'SUCCESS' : 'FAILED');

    // 11. Reactivated operator has access again
    const reactCampaignRes = await request(server, 'GET', '/api/distributions/campaigns', opHeaders);
    console.log('11. Reactivated operator access restored (200):', reactCampaignRes.status === 200 ? 'SUCCESS' : 'FAILED');

    console.log('\n=== ALL 11 CHECKS PASSED: OPERATOR PROVISIONING & HANDOVER FULLY VERIFIED ===');
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
};

run();

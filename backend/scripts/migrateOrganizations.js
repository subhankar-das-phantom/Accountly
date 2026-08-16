require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const Transaction = require('../models/transaction.model');
const { generateSlug } = require('../services/organizationService');

const isDryRun = process.argv.includes('--dry-run');

const runMigration = async () => {
  console.log(`\n=== Starting Organization Migration ${isDryRun ? '[DRY-RUN]' : ''} ===\n`);

  if (!process.env.ATLAS_URI) {
    console.error('ATLAS_URI is missing from environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.ATLAS_URI);
    console.log('Connected to MongoDB.\n');

    const users = await User.find({});
    
    let stats = {
      usersProcessed: 0,
      organizationsCreated: 0,
      transactionsUpdated: 0,
      transactionsSkipped: 0,
      errors: 0
    };

    for (const user of users) {
      try {
        stats.usersProcessed++;
        
        // 1. Find or Create Default Organization for the user
        let organization = await Organization.findOne({ owner: user._id });
        
        if (!organization) {
          if (!isDryRun) {
            let baseSlug = generateSlug(`${user.username}'s Accountly`);
            let slug = baseSlug;
            let counter = 1;
            while (await Organization.findOne({ slug })) {
              slug = `${baseSlug}-${counter}`;
              counter++;
            }

            organization = new Organization({
              name: `${user.username}'s Accountly`,
              slug: slug,
              description: 'Default Organization',
              currency: user.currency || { code: 'INR', locale: 'en-IN' },
              owner: user._id
            });
            await organization.save();
          }
          stats.organizationsCreated++;
          console.log(`[${user.username}] Created organization`);
        } else {
          console.log(`[${user.username}] Found existing organization`);
        }

        // 2. Migrate User's Transactions to the Organization
        const transactions = await Transaction.find({ user: user._id });
        let userTxUpdates = 0;
        let userTxSkips = 0;

        for (const tx of transactions) {
          if (!tx.organizationId) {
            if (!isDryRun && organization) {
              tx.organizationId = organization._id;
              await tx.save();
            }
            userTxUpdates++;
            stats.transactionsUpdated++;
          } else {
            userTxSkips++;
            stats.transactionsSkipped++;
          }
        }
        
        if (userTxUpdates > 0 || userTxSkips > 0) {
          console.log(`    -> Transactions: ${userTxUpdates} updated, ${userTxSkips} skipped`);
        }

      } catch (err) {
        console.error(`Error processing user ${user.username} (${user._id}):`, err);
        stats.errors++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Users processed: ${stats.usersProcessed}`);
    console.log(`Organizations created: ${stats.organizationsCreated}`);
    console.log(`Transactions updated: ${stats.transactionsUpdated}`);
    console.log(`Transactions skipped: ${stats.transactionsSkipped}`);
    console.log(`Errors: ${stats.errors}`);
    
    if (isDryRun) {
      console.log('\nNOTE: This was a dry-run. No database writes were performed.');
    }

  } catch (err) {
    console.error('Fatal error during migration:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
};

runMigration();

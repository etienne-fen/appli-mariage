#!/usr/bin/env node
// Admin access to the real Firestore (bypasses security rules — use with care).
//
// Key file: FIREBASE_SA env var, or by default
//   %USERPROFILE%\.secrets\appli-mariage-service-account.json
// (kept outside the repo / OneDrive on purpose).
//
// Usage:
//   node scripts/firestore.js collections
//   node scripts/firestore.js list   <collection> [limit]
//   node scripts/firestore.js get    <collection/docId>
//   node scripts/firestore.js set    <collection/docId> '<json>' | @file.json
//   node scripts/firestore.js update <collection/docId> '<json>' | @file.json   (merge, dotted keys ok)
//   node scripts/firestore.js delete <collection/docId>
//   node scripts/firestore.js friday list | sync | add <householdId> | remove <householdId>
//     (invitation-only Friday events; keeps access/friday.phones in sync)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const keyPath =
  process.env.FIREBASE_SA ||
  path.join(os.homedir(), '.secrets', 'appli-mariage-service-account.json');

if (!fs.existsSync(keyPath)) {
  console.error(`Service-account key not found at: ${keyPath}`);
  process.exit(1);
}

initializeApp({ credential: cert(require(keyPath)) });
const db = getFirestore();

const readJson = (arg) => {
  if (!arg) throw new Error('Missing JSON payload');
  const text = arg.startsWith('@') ? fs.readFileSync(arg.slice(1), 'utf8') : arg;
  return JSON.parse(text);
};

const print = (obj) => console.log(JSON.stringify(obj, null, 2));

async function main() {
  const [cmd, target, payload] = process.argv.slice(2);
  switch (cmd) {
    case 'collections': {
      const cols = await db.listCollections();
      for (const c of cols) {
        const n = (await c.count().get()).data().count;
        console.log(`${c.id}\t${n} docs`);
      }
      break;
    }
    case 'list': {
      const limit = Number(payload) || 1000;
      const snap = await db.collection(target).limit(limit).get();
      print(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      break;
    }
    case 'get': {
      const d = await db.doc(target).get();
      print(d.exists ? { id: d.id, ...d.data() } : null);
      break;
    }
    case 'set':
      await db.doc(target).set(readJson(payload));
      console.log(`set ${target}`);
      break;
    case 'update':
      await db.doc(target).update(readJson(payload));
      console.log(`updated ${target}`);
      break;
    case 'delete':
      await db.doc(target).delete();
      console.log(`deleted ${target}`);
      break;
    case 'friday':
      await friday(target, payload);
      break;
    default:
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 17).join('\n'));
  }
}

// access/friday = { householdIds (source of truth), phones (derived from their managerPhones) }
async function friday(action, householdId) {
  const ref = db.doc('access/friday');
  const snap = await ref.get();
  let ids = snap.exists ? snap.data().householdIds ?? [] : [];

  if (action === 'add' || action === 'remove') {
    if (!householdId) throw new Error('Missing householdId');
    if (action === 'add') {
      if (!(await db.doc(`households/${householdId}`).get()).exists) throw new Error(`No household ${householdId}`);
      ids = [...new Set([...ids, householdId])];
    } else {
      ids = ids.filter((id) => id !== householdId);
    }
  } else if (action !== 'sync' && action !== 'list') {
    throw new Error('Usage: friday list | sync | add <householdId> | remove <householdId>');
  }

  const households = await Promise.all(ids.map((id) => db.doc(`households/${id}`).get()));
  if (action !== 'list') {
    const phones = [...new Set(households.flatMap((h) => (h.exists ? h.data().managerPhones ?? [] : [])))];
    await ref.set({ householdIds: ids, phones });
  }
  households.forEach((h) =>
    console.log(`${h.id}\t${h.exists ? h.data().displayName || '' : '(missing household!)'}\t${(h.exists && h.data().managerPhones || []).length} phone(s)`)
  );
  console.log(`${ids.length} household(s) invited on Friday`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

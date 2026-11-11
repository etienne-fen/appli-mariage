#!/usr/bin/env node
// Publishes firestore.rules to the live project with the service-account key
// (no `firebase login` needed). Prints the previous ruleset so it can be restored.
//
//   node scripts/deploy-rules.js                     → publish ./firestore.rules
//   node scripts/deploy-rules.js --diff              → compare live rules with ./firestore.rules
//   node scripts/deploy-rules.js --rollback <name>   → re-activate a previous ruleset
//                                                      (projects/appli-mariage/rulesets/…)

const fs = require('fs')
const os = require('os')
const path = require('path')
const { GoogleAuth } = require('google-auth-library')

const PROJECT = 'projects/appli-mariage'
const API = 'https://firebaserules.googleapis.com/v1'
const RULES = path.join(__dirname, '..', 'firestore.rules')
const keyFile = process.env.FIREBASE_SA || path.join(os.homedir(), '.secrets', 'appli-mariage-service-account.json')

;(async () => {
  const client = await new GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient()
  const release = (await client.request({ url: `${API}/${PROJECT}/releases/cloud.firestore` })).data
  const [mode, arg] = process.argv.slice(2)

  if (mode === '--diff') {
    const live = (await client.request({ url: `${API}/${release.rulesetName}` })).data.source.files[0].content
    const same = live.replace(/\r\n/g, '\n').trim() === fs.readFileSync(RULES, 'utf8').replace(/\r\n/g, '\n').trim()
    console.log(same ? 'Live rules = firestore.rules ✓' : 'Live rules DIFFER from firestore.rules')
    console.log(`live since ${release.updateTime}`)
    return
  }

  let rulesetName
  if (mode === '--rollback') {
    if (!arg) throw new Error('Usage: --rollback projects/appli-mariage/rulesets/<id>')
    rulesetName = arg
  } else {
    const content = fs.readFileSync(RULES, 'utf8')
    const created = await client.request({
      url: `${API}/${PROJECT}/rulesets`, method: 'POST',
      data: { source: { files: [{ name: 'firestore.rules', content }] } },
    })
    rulesetName = created.data.name
  }
  await client.request({
    url: `${API}/${PROJECT}/releases/cloud.firestore`, method: 'PATCH',
    data: { release: { name: `${PROJECT}/releases/cloud.firestore`, rulesetName } },
  })
  console.log(`previous: ${release.rulesetName}\nnow:      ${rulesetName}`)
})().catch(e => { console.error(JSON.stringify(e.response?.data?.error ?? e.message, null, 2)); process.exit(1) })

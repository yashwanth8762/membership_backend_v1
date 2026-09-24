/**
 * Re-migrate ONLY the cards that were previously under Bengaluru urban / Bengaluru taluk,
 * using the Vidhanasabha / Assembly Constituency field (not address).
 *
 * Source of card list: reports/Bengaluru_Urban_Migration_Report.xlsx
 *
 * Usage:
 *   node scripts/remigrateByVidhanasabha.js --dry-run
 *   node scripts/remigrateByVidhanasabha.js --apply
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const District = require('../Modals/District');
const Taluk = require('../Modals/Taluk');
const { MembershipSubmission } = require('../Modals/Membership');

const APPLY = process.argv.includes('--apply');
const REPORT_PATH = path.join(__dirname, '..', 'reports', 'Bengaluru_Urban_Migration_Report.xlsx');

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    // Keep letters, numbers, and combining marks (Kannada matras/virama)
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getVidhana(values = []) {
  for (const v of values || []) {
    const label = String(v.label || '');
    if (/vidhan|assembly|constituency|ವಿಧಾನ|ಲೋಕಸಭಾ/i.test(label)) {
      if (v.value != null && String(v.value).trim()) return String(v.value).trim();
    }
  }
  return '';
}

function getName(values = []) {
  for (const v of values || []) {
    const label = String(v.label || '');
    if (/applicant\s*name|^name$|ಅರ್ಜಿದಾರನ|ಹೆಸರು/i.test(label) && !/father|mother|husband|ತಂದೆ/i.test(label)) {
      if (v.value != null && String(v.value).trim()) return String(v.value).trim();
    }
  }
  return '';
}

function getAddress(values = []) {
  for (const v of values || []) {
    const label = String(v.label || '');
    if (/address|ವಿಳಾಸ|adress/i.test(label)) {
      if (v.value != null && String(v.value).trim()) return String(v.value).trim();
    }
  }
  return '';
}

/**
 * Ordered specific → general. First keyword hit with highest score wins.
 * Maps to corporation assembly taluks.
 */
const RULES = [
  // Central
  { district: 'Bengaluru Central', taluk: 'Chamarajapet', keywords: ['chamarajpet', 'chamrajpet', 'chamarajapet', 'chamarajpete', 'chamrajpete', 'chamaraja pete', 'chamaraj pete', 'chamaraj pet', 'chamarjapet', 'chamarjpet', 'chamaranpet', 'chanarajpet', 'ಚಾಮರಾಜಪೇಟೆ', 'ಚಾಮರಾಜ ಪೇಟೆ', 'chamarjpete', 'chamrajapet'] },
  { district: 'Bengaluru Central', taluk: 'Chickpet', keywords: ['chickpet', 'chikkapet', 'chikkapete', 'chickpete', 'ಚಿಕ್ಕಪೇಟೆ'] },
  { district: 'Bengaluru Central', taluk: 'Shanthinagar', keywords: ['shanthinagar', 'shanthinagara', 'shanti nagar', 'shanthi nagar', 'shantinagar', 'ಶಾಂತಿನಗರ'] },
  { district: 'Bengaluru Central', taluk: 'C.V. Raman Nagar', keywords: ['c v raman', 'cv raman', 'c.v. raman', 'ಸಿ.ವಿ'] },
  { district: 'Bengaluru Central', taluk: 'Shivajinagar', keywords: ['shivajinagar', 'shivaji nagar', 'shivaji nagara', 'ಶಿವಾಜಿನಗರ'] },
  { district: 'Bengaluru Central', taluk: 'Gandhinagar', keywords: ['gandhinagar', 'gandhi nagar', 'gandhinagara', 'ghandhinagara', 'ghandinagara', 'ಗಾಂಧಿನಗರ'] },

  // East
  { district: 'Bengaluru East', taluk: 'Mahadevapura', keywords: ['mahadevapura', 'mahadevpura', 'madevapura', 'mahadevapra', 'mahadeva pura', 'ಮಹದೇವಪುರ', 'ಮಹಾದೇವಪುರ'] },
  { district: 'Bengaluru East', taluk: 'K.R. Puram', keywords: ['k r puram', 'kr puram', 'k.r. puram', 'krishnarajapuram', 'kr pura', 'kr purm', 'kr ಪುರಂ', 'ಕೆ ಆರ್', 'ಕೆ.ಆರ್'] },

  // North
  { district: 'Bengaluru North', taluk: 'Yelahanka', keywords: ['yelahanka', 'yalanka', 'yalahanka', 'yrlahanka', 'ಯಲಹಂಕ'] },
  { district: 'Bengaluru North', taluk: 'Dasarahalli', keywords: ['dasarahalli', 'dasrahalli', 'darsahali', 'dasarhali', 't dasarahalli', 't.dasarahalli', 't.dasrahalli', 'ದಾಸರಹಳ್ಳಿ', 'ಟಿ ದಾಸರಹಳ್ಳಿ', 'vedhansabha dasrahalli'] },
  { district: 'Bengaluru North', taluk: 'Hebbal', keywords: ['hebbal', 'hebbala', 'ಹೆಬ್ಬಾಳ'] },
  { district: 'Bengaluru North', taluk: 'Byatarayanapura', keywords: ['byatarayanapura', 'byataraynapura', 'ಬ್ಯಾಟರಾಯನಪುರ'] },
  { district: 'Bengaluru North', taluk: 'Pulakeshinagar', keywords: ['pulakeshinagar', 'pulakeshin', 'pulkeshi', 'pulikeshinagar', 'ಪುಲಿಕೇಶಿ'] },
  { district: 'Bengaluru North', taluk: 'Sarvagnanagar', keywords: ['sarvagnanagar', 'sarvagna nagar', 'sarvagan nagar', 'ಸರ್ವಜ್ಞ'] },

  // South
  { district: 'Bengaluru South', taluk: 'B.T.M Layout', keywords: ['btm', 'b t m', 'b.t.m', 'ಬಿ.ಟಿ.ಎಂ'] },
  { district: 'Bengaluru South', taluk: 'Jayanagar', keywords: ['jayanagar', 'ಜಯನಗರ'] },
  { district: 'Bengaluru South', taluk: 'Bommanahalli', keywords: ['bommanahalli', 'ಬೊಮ್ಮನಹಳ್ಳಿ'] },
  { district: 'Bengaluru South', taluk: 'Padmanabhanagar', keywords: ['padmanabhanagar', 'padmanbhanagar', 'padmanabha nagar', 'ಪದ್ಮನಾಭನಗರ', 'katruguppe'] },
  { district: 'Bengaluru South', taluk: 'Rajarajeshwari Nagar', keywords: ['rajarajeshwari', 'rajarajeshvari', 'rr nagar', 'r r nagar', 'ರಾಜರಾಜೇಶ್ವರಿ'] },
  { district: 'Bengaluru South', taluk: 'Anekal', keywords: ['anekal', 'ಆನೇಕಲ್'] },
  { district: 'Bengaluru South', taluk: 'Bengaluru South', keywords: ['bengaluru south', 'bangalore south', 'banglore south', 'ಬೆಂಗಳೂರು ಸೌತ್', 'ಬೆಂಗಳೂರು ದಕ್ಷಿಣ', 'dakshina vidhansabha'] },

  // West
  { district: 'Bengaluru West', taluk: 'Malleshwaram', keywords: ['malleshwaram', 'malleswaram', 'malleswara', 'malleswram', 'malleswarm', 'ಮಲ್ಲೇಶ್ವರ'] },
  { district: 'Bengaluru West', taluk: 'Rajajinagar', keywords: ['rajajinagar', 'rajathi nagara', 'ರಾಜಾಜಿ'] },
  { district: 'Bengaluru West', taluk: 'Mahalakshmi Layout', keywords: ['mahalakshmi', 'ಮಹಾಲಕ್ಷ್ಮಿ', 'nandini layout', 'kanteerava'] },
  { district: 'Bengaluru West', taluk: 'Govindarajanagar', keywords: ['govindarajanagar', 'govindarajnagar', 'govindaraja nagara', 'govindrajnagar', 'govind nagar', 'ಗೋವಿಂದರಾಜ'] },
  { district: 'Bengaluru West', taluk: 'Vijayanagar', keywords: ['vijayanagar', 'vijaynagar', 'vijaya nagar', 'vijay nagar', 'vijayanagara', 'vijayangara', 'vjaynagar', 'ವಿಜಯನಗರ', 'rayapuram'] },
  { district: 'Bengaluru West', taluk: 'Basavanagudi', keywords: ['basavanagudi', 'ಬಸವನಗುಡಿ'] },
  { district: 'Bengaluru West', taluk: 'Yeshwanthpur', keywords: ['yeshwanthpur', 'yeshwanthpura', 'yeshwantpura', 'yeswanthpur', 'yeswanthapur', 'yeshavanthapura', 'yeshavantha', 'yashawanthapura', 'yashvantahpura', 'yashwantpur', 'ಯಶವಂತ'] },
];

function classifyVidhana(raw) {
  const text = normalize(raw);
  const compact = text.replace(/\s+/g, '');
  if (!text) {
    return { matched: false, reason: 'empty_vidhana', score: 0 };
  }

  let best = null;
  for (const rule of RULES) {
    let score = 0;
    const hits = [];
    for (const kw of rule.keywords) {
      const nkw = normalize(kw);
      const nkwCompact = nkw.replace(/\s+/g, '');
      if (!nkw) continue;
      if (text.includes(nkw) || (nkwCompact.length >= 4 && compact.includes(nkwCompact))) {
        score += Math.max(3, nkw.length / 3);
        hits.push(kw);
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = {
        matched: true,
        districtName: rule.district,
        talukName: rule.taluk,
        score,
        matchedKeywords: hits.join(', '),
        reason: 'vidhana_keyword',
      };
    }
  }

  if (best) return best;

  // Soft region-only fallbacks from parliament/region words
  if (/central|ಸೆಂಟ್ರಲ್|center|centre/.test(text)) {
    return {
      matched: true,
      districtName: 'Bengaluru Central',
      talukName: 'Gandhinagar',
      score: 1,
      matchedKeywords: 'central_fallback',
      reason: 'region_fallback_central',
    };
  }
  if (/north|ಉತ್ತರ|uttara/.test(text) && !/rural|ಗ್ರಾಮ|ಗ್ರಾಮೀಣ/.test(text)) {
    return {
      matched: true,
      districtName: 'Bengaluru North',
      talukName: 'Hebbal',
      score: 1,
      matchedKeywords: 'north_fallback',
      reason: 'region_fallback_north',
    };
  }
  if (/south|ದಕ್ಷಿಣ|ಸೌತ್/.test(text)) {
    return {
      matched: true,
      districtName: 'Bengaluru South',
      talukName: 'Bengaluru South',
      score: 1,
      matchedKeywords: 'south_fallback',
      reason: 'region_fallback_south',
    };
  }
  if (/west|ಪಶ್ಚಿಮ|wesr/.test(text)) {
    return {
      matched: true,
      districtName: 'Bengaluru West',
      talukName: 'Vijayanagar',
      score: 1,
      matchedKeywords: 'west_fallback',
      reason: 'region_fallback_west',
    };
  }
  if (/east|ಪೂರ್ವ/.test(text)) {
    return {
      matched: true,
      districtName: 'Bengaluru East',
      talukName: 'Mahadevapura',
      score: 1,
      matchedKeywords: 'east_fallback',
      reason: 'region_fallback_east',
    };
  }

  // Outside Bangalore corporation — leave as-is
  if (/chikkaballapur|chikballapur|gouribidanur|kolar|ಚಿಕ್ಕಬಳ್ಳಾಪುರ/.test(text)) {
    return {
      matched: false,
      reason: 'outside_bangalore_vidhana',
      score: 0,
      matchedKeywords: '',
    };
  }

  return {
    matched: false,
    reason: 'unmatched_vidhana',
    score: 0,
    matchedKeywords: '',
  };
}

async function loadTargetCards() {
  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error(`Migration report not found: ${REPORT_PATH}`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(REPORT_PATH);
  const ws = wb.getWorksheet('Migration Report');
  const membershipIds = [];
  const objectIds = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const id = String(row.getCell(2).value || '').trim();
    if (!id) return;
    if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
      objectIds.push(id);
    } else {
      membershipIds.push(id);
    }
  });

  const byMembership = membershipIds.length
    ? await MembershipSubmission.find({ membershipId: { $in: membershipIds } }).lean()
    : [];
  const byOid = objectIds.length
    ? await MembershipSubmission.find({ _id: { $in: objectIds } }).lean()
    : [];

  const map = new Map();
  for (const doc of [...byMembership, ...byOid]) {
    map.set(String(doc._id), doc);
  }
  return {
    cards: [...map.values()],
    requested: membershipIds.length + objectIds.length,
  };
}

async function resolveTargets() {
  const names = [
    'Bengaluru Central',
    'Bengaluru East',
    'Bengaluru North',
    'Bengaluru South',
    'Bengaluru West',
  ];
  const districts = await District.find({
    name: { $in: names },
    is_archived: { $ne: true },
  }).lean();
  const byName = {};
  for (const d of districts) byName[d.name] = d;
  for (const n of names) {
    if (!byName[n]) throw new Error(`Missing district ${n}`);
  }
  const taluks = await Taluk.find({
    district: { $in: districts.map((d) => d._id) },
    is_archived: { $ne: true },
  }).lean();
  const talukMap = {};
  for (const t of taluks) {
    const dist = districts.find((d) => String(d._id) === String(t.district));
    if (!dist) continue;
    talukMap[`${dist.name}||${normalize(t.name)}`] = t;
  }
  return { byName, talukMap };
}

async function writeExcel(rows, summary, outPath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Vidhana Remigration');
  ws.columns = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Membership ID', key: 'membershipId', width: 16 },
    { header: 'Mongo ID', key: 'mongoId', width: 26 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Payment', key: 'paymentStatus', width: 12 },
    { header: 'Vidhanasabha', key: 'vidhana', width: 40 },
    { header: 'Previous District', key: 'prevDistrict', width: 20 },
    { header: 'Previous Taluk', key: 'prevTaluk', width: 20 },
    { header: 'To District', key: 'toDistrict', width: 20 },
    { header: 'To Taluk', key: 'toTaluk', width: 22 },
    { header: 'Score', key: 'score', width: 8 },
    { header: 'Matched On', key: 'matchedKeywords', width: 30 },
    { header: 'Reason', key: 'reason', width: 22 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));

  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { header: 'Metric', key: 'metric', width: 40 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  sum.getRow(1).font = { bold: true };
  Object.entries(summary).forEach(([metric, value]) => sum.addRow({ metric, value }));

  const byTarget = wb.addWorksheet('By Target');
  byTarget.columns = [
    { header: 'To District', key: 'district', width: 22 },
    { header: 'To Taluk', key: 'taluk', width: 24 },
    { header: 'Count', key: 'count', width: 10 },
  ];
  byTarget.getRow(1).font = { bold: true };
  const counts = {};
  for (const r of rows) {
    if (r.status === 'MIGRATED' || r.status === 'WOULD_MIGRATE' || r.status === 'ALREADY_CORRECT') {
      const k = `${r.toDistrict}||${r.toTaluk}`;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, count]) => {
      const [district, taluk] = k.split('||');
      byTarget.addRow({ district, taluk, count });
    });

  await wb.xlsx.writeFile(outPath);
}

async function main() {
  await mongoose.connect(process.env.DB_URL);
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN mode');
  console.log('Scope: ONLY cards from previous Bengaluru urban/Bengaluru migration report');

  const { cards, requested } = await loadTargetCards();
  console.log(`Report requested: ${requested}, loaded cards: ${cards.length}`);

  const { byName, talukMap } = await resolveTargets();

  // populate current district/taluk names
  const distIds = [...new Set(cards.map((c) => String(c.district)))];
  const talukIds = [...new Set(cards.map((c) => String(c.taluk)))];
  const dists = await District.find({ _id: { $in: distIds } }).lean();
  const taluks = await Taluk.find({ _id: { $in: talukIds } }).lean();
  const distNameById = Object.fromEntries(dists.map((d) => [String(d._id), d.name]));
  const talukNameById = Object.fromEntries(taluks.map((t) => [String(t._id), t.name]));

  const rows = [];
  let would = 0;
  let migrated = 0;
  let already = 0;
  let unmatched = 0;
  let missingTarget = 0;
  let errors = 0;
  let unchangedUnmatched = 0;

  for (let i = 0; i < cards.length; i++) {
    const sub = cards[i];
    const vidhana = getVidhana(sub.values);
    const classification = classifyVidhana(vidhana);
    const prevDistrict = distNameById[String(sub.district)] || '';
    const prevTaluk = talukNameById[String(sub.taluk)] || '';

    const base = {
      sno: i + 1,
      membershipId: sub.membershipId || '',
      mongoId: String(sub._id),
      name: getName(sub.values),
      paymentStatus: sub.paymentResult?.status || '',
      vidhana,
      prevDistrict,
      prevTaluk,
      toDistrict: classification.districtName || '',
      toTaluk: classification.talukName || '',
      score: classification.score || 0,
      matchedKeywords: classification.matchedKeywords || '',
      reason: classification.reason || '',
      status: '',
    };

    if (!classification.matched) {
      unmatched += 1;
      unchangedUnmatched += 1;
      base.status = 'UNMATCHED_LEFT_AS_IS';
      rows.push(base);
      continue;
    }

    const targetDistrict = byName[classification.districtName];
    const targetTaluk = talukMap[`${classification.districtName}||${normalize(classification.talukName)}`];
    if (!targetDistrict || !targetTaluk) {
      missingTarget += 1;
      base.status = 'MISSING_TARGET';
      base.reason = `missing:${classification.districtName}/${classification.talukName}`;
      rows.push(base);
      continue;
    }

    base.toDistrict = targetDistrict.name;
    base.toTaluk = targetTaluk.name;

    const same =
      String(sub.district) === String(targetDistrict._id) &&
      String(sub.taluk) === String(targetTaluk._id);

    if (same) {
      already += 1;
      base.status = 'ALREADY_CORRECT';
      rows.push(base);
      continue;
    }

    if (!APPLY) {
      would += 1;
      base.status = 'WOULD_MIGRATE';
      rows.push(base);
      continue;
    }

    try {
      const result = await MembershipSubmission.updateOne(
        { _id: sub._id },
        { $set: { district: targetDistrict._id, taluk: targetTaluk._id } }
      );
      if (result.modifiedCount === 1 || result.matchedCount === 1) {
        migrated += 1;
        base.status = 'MIGRATED';
      } else {
        errors += 1;
        base.status = 'UPDATE_FAILED';
      }
    } catch (e) {
      errors += 1;
      base.status = 'ERROR';
      base.reason = e.message;
    }
    rows.push(base);
    if ((i + 1) % 100 === 0) console.log(`Processed ${i + 1}/${cards.length}`);
  }

  const summary = {
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    report_requested: requested,
    cards_loaded: cards.length,
    would_migrate: would,
    migrated,
    already_correct: already,
    unmatched_left_as_is: unmatched,
    missing_target: missingTarget,
    errors,
    generated_at: new Date().toISOString(),
    note: 'Only cards from previous Bengaluru urban/Bengaluru migration were touched',
  };

  const outDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(
    outDir,
    `vidhana_remigration_${APPLY ? 'applied' : 'dryrun'}_${stamp}.xlsx`
  );
  await writeExcel(rows, summary, outPath);
  // stable copy
  fs.copyFileSync(outPath, path.join(outDir, 'Vidhana_Remigration_Report.xlsx'));

  console.log('\nSummary:', summary);
  console.log('Excel:', outPath);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

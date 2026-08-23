/**
 * Remap bad "Bangalore *" duplicate districts into official Bengaluru palike districts,
 * then archive (soft-remove) the old districts/taluks.
 *
 * Rules:
 * - Bangalore East  → Bengaluru East  / Mahadevapura
 * - Bangalore North → Bengaluru North / first active taluk (Byatarayanapura preferred)
 * - Bangalore Centre/Center/Central → Bengaluru Central / first active taluk (Shanthinagar preferred)
 * - Bangalore South → Bengaluru South / first active taluk (Jayanagar preferred)
 * - Bangalore West  → Bengaluru West  / first active taluk (Malleshwaram preferred)
 * - lowercase duplicate "bengaluru urban" → Bengaluru urban, matching taluk by name when possible
 *
 * Does NOT touch: Bengaluru rural, official Bengaluru urban, or the 5 palike districts.
 *
 * Usage:
 *   node scripts/remapBangaloreDuplicates.js
 *   node scripts/remapBangaloreDuplicates.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const District = require('../Modals/District');
const Taluk = require('../Modals/Taluk');
const { MembershipSubmission } = require('../Modals/Membership');

const DRY_RUN = process.argv.includes('--dry-run');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(name = '') {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
}

async function findDistrictExact(name) {
  return District.findOne({
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
    is_archived: { $ne: true },
  });
}

async function findPreferredTaluk(districtId, preferredNames = []) {
  const taluks = await Taluk.find({
    district: districtId,
    is_active: true,
    is_archived: { $ne: true },
  }).lean();

  if (!taluks.length) return null;

  for (const preferred of preferredNames) {
    const hit = taluks.find((t) => normalize(t.name) === normalize(preferred));
    if (hit) return hit;
  }
  return taluks[0];
}

function classifySourceDistrict(name) {
  const n = normalize(name);

  // Keep official names
  if (
    n === 'bengaluru rural' ||
    n === 'bengaluru urban' ||
    n === 'bengaluru central' ||
    n === 'bengaluru east' ||
    n === 'bengaluru north' ||
    n === 'bengaluru south' ||
    n === 'bengaluru west'
  ) {
    return null;
  }

  // Duplicate urban with odd casing already handled as exact "bengaluru urban" above.
  // Catch near-duplicates like "bengaluru  urban"
  if (/^bengaluru\s+urban$/.test(n)) return null;

  // Bangalore / Banglore spelling variants
  const m = n.match(/^(bangalore|banglore)\s+(east|north|south|west|centre|center|central)$/);
  if (m) {
    const region = m[2];
    if (region === 'centre' || region === 'center' || region === 'central') return 'central';
    return region;
  }

  // Loose matches seen in reports
  if (/^(bangalore|banglore).*east$/.test(n) || n === 'bangalore east') return 'east';
  if (/^(bangalore|banglore).*north$/.test(n)) return 'north';
  if (/^(bangalore|banglore).*(centre|center|central)$/.test(n)) return 'central';
  if (/^(bangalore|banglore).*south$/.test(n)) return 'south';
  if (/^(bangalore|banglore).*west$/.test(n)) return 'west';

  return null;
}

const TARGETS = {
  east: {
    districtName: 'Bengaluru East',
    preferredTaluks: ['Mahadevapura', 'Mahadevpura'],
  },
  north: {
    districtName: 'Bengaluru North',
    preferredTaluks: ['Byatarayanapura', 'Yelahanka', 'Hebbal'],
  },
  central: {
    districtName: 'Bengaluru Central',
    preferredTaluks: ['Shanthinagar', 'Shivajinagar', 'Gandhinagar'],
  },
  south: {
    districtName: 'Bengaluru South',
    preferredTaluks: ['Jayanagar', 'Bommanahalli', 'Anekal'],
  },
  west: {
    districtName: 'Bengaluru West',
    preferredTaluks: ['Malleshwaram', 'Rajajinagar', 'Basavanagudi'],
  },
};

async function remapMemberships({ sourceDistrict, sourceTalukIds, targetDistrict, targetTaluk, label }) {
  const filter = { district: sourceDistrict._id };
  const total = await MembershipSubmission.countDocuments(filter);
  console.log(`\n[${label}] ${sourceDistrict.name} → ${targetDistrict.name} / ${targetTaluk.name}`);
  console.log(`  memberships to move: ${total}`);

  if (total === 0) {
    return { moved: 0 };
  }

  if (DRY_RUN) {
    console.log('  dry-run: skip update');
    return { moved: total };
  }

  const result = await MembershipSubmission.updateMany(filter, {
    $set: {
      district: targetDistrict._id,
      taluk: targetTaluk._id,
    },
  });

  console.log(`  updated: ${result.modifiedCount}`);
  return { moved: result.modifiedCount };
}

async function archiveDistrictAndTaluks(district) {
  const taluks = await Taluk.find({ district: district._id });
  console.log(`  archive district "${district.name}" + ${taluks.length} taluk(s)`);

  if (DRY_RUN) return;

  await District.updateOne(
    { _id: district._id },
    { $set: { is_active: false, is_archived: true } }
  );
  await Taluk.updateMany(
    { district: district._id },
    { $set: { is_active: false, is_archived: true } }
  );
}

async function remapDuplicateUrban() {
  // Find extra "bengaluru urban" docs that are not the canonical district_id=5 / Title-ish name
  const urbans = await District.find({
    name: { $regex: /^bengaluru\s+urban$/i },
  }).lean();

  if (urbans.length <= 1) {
    console.log('\nNo duplicate Bengaluru urban districts to remap.');
    return { moved: 0 };
  }

  // Prefer the one with taluks named anekal/yelahanka/bengaluru or highest district_id history (id 5)
  const scored = [];
  for (const d of urbans) {
    const talukCount = await Taluk.countDocuments({ district: d._id });
    const memCount = await MembershipSubmission.countDocuments({ district: d._id });
    scored.push({ d, talukCount, memCount, score: (d.district_id === 5 ? 1000 : 0) + talukCount });
  }
  scored.sort((a, b) => b.score - a.score || b.memCount - a.memCount);
  const canonical = scored[0].d;
  const duplicates = scored.slice(1).map((s) => s.d);

  console.log(`\nCanonical Bengaluru urban: ${canonical.name} (${canonical._id})`);
  const canonicalTaluks = await Taluk.find({
    district: canonical._id,
    is_active: true,
    is_archived: { $ne: true },
  }).lean();
  const fallbackTaluk =
    canonicalTaluks.find((t) => normalize(t.name) === 'yelahanka') ||
    canonicalTaluks.find((t) => normalize(t.name) === 'bengaluru') ||
    canonicalTaluks[0];

  if (!fallbackTaluk) {
    console.log('  ERROR: canonical Bengaluru urban has no taluks');
    return { moved: 0 };
  }

  let moved = 0;
  for (const dup of duplicates) {
    const dupTaluks = await Taluk.find({ district: dup._id }).lean();
    const submissions = await MembershipSubmission.find({ district: dup._id }).select('_id taluk').lean();
    console.log(`  duplicate urban "${dup.name}" memberships: ${submissions.length}`);

    for (const sub of submissions) {
      const oldTaluk = dupTaluks.find((t) => String(t._id) === String(sub.taluk));
      let targetTaluk = fallbackTaluk;
      if (oldTaluk) {
        const match = canonicalTaluks.find((t) => normalize(t.name) === normalize(oldTaluk.name));
        if (match) targetTaluk = match;
      }

      if (!DRY_RUN) {
        await MembershipSubmission.updateOne(
          { _id: sub._id },
          { $set: { district: canonical._id, taluk: targetTaluk._id } }
        );
      }
      moved += 1;
    }

    await archiveDistrictAndTaluks(dup);
  }

  return { moved };
}

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error('DB_URL missing');
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  console.log(DRY_RUN ? 'DRY RUN — no writes will be made\n' : 'LIVE RUN — remapping memberships\n');

  // Resolve targets
  const resolvedTargets = {};
  for (const [key, cfg] of Object.entries(TARGETS)) {
    const district = await findDistrictExact(cfg.districtName);
    if (!district) {
      console.error(`Missing target district: ${cfg.districtName}. Run seed:bengaluru-palike first.`);
      process.exit(1);
    }
    const taluk = await findPreferredTaluk(district._id, cfg.preferredTaluks);
    if (!taluk) {
      console.error(`Missing taluks under ${cfg.districtName}`);
      process.exit(1);
    }
    resolvedTargets[key] = { district, taluk };
    console.log(`Target ${key}: ${district.name} / ${taluk.name}`);
  }

  const allDistricts = await District.find({ is_archived: { $ne: true } }).lean();
  let totalMoved = 0;
  let archived = 0;

  for (const source of allDistricts) {
    const region = classifySourceDistrict(source.name);
    if (!region) continue;

    const target = resolvedTargets[region];
    if (!target) continue;

    // Skip if this somehow is already the target district
    if (String(source._id) === String(target.district._id)) continue;

    const sourceTaluks = await Taluk.find({ district: source._id }).select('_id').lean();
    const { moved } = await remapMemberships({
      sourceDistrict: source,
      sourceTalukIds: sourceTaluks.map((t) => t._id),
      targetDistrict: target.district,
      targetTaluk: target.taluk,
      label: region.toUpperCase(),
    });
    totalMoved += moved;
    await archiveDistrictAndTaluks(source);
    archived += 1;
  }

  const urbanResult = await remapDuplicateUrban();
  totalMoved += urbanResult.moved;

  console.log('\nDone.');
  console.log(`Memberships remapped: ${totalMoved}`);
  console.log(`Source districts archived: ${archived}`);
  if (DRY_RUN) console.log('(dry-run only — re-run without --dry-run to apply)');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

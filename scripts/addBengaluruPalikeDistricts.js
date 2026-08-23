/**
 * Idempotent seed: add Bengaluru corporation (palike) districts + taluks.
 * - Creates district only if missing (by English name, case-insensitive)
 * - Creates taluk only if missing under that district (by English name, case-insensitive)
 * - Never updates, renames, archives, or deletes existing districts/taluks
 *
 * Usage: node scripts/addBengaluruPalikeDistricts.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const District = require('../Modals/District');
const Taluk = require('../Modals/Taluk');

const DATA = [
  {
    name: 'Bengaluru Central',
    k_name: 'ಬೆಂಗಳೂರು ಕೇಂದ್ರ ಪಾಲಿಕೆ',
    taluks: [
      { name: 'Shanthinagar', k_name: 'ಶಾಂತಿನಗರ' },
      { name: 'C.V. Raman Nagar', k_name: 'ಸಿ.ವಿ. ರಾಮನ್ ನಗರ' },
      { name: 'Shivajinagar', k_name: 'ಶಿವಾಜಿನಗರ' },
      { name: 'Gandhinagar', k_name: 'ಗಾಂಧಿನಗರ' },
      { name: 'Chickpet', k_name: 'ಚಿಕ್ಕಪೇಟೆ' },
      { name: 'Chamarajapet', k_name: 'ಚಾಮರಾಜಪೇಟೆ' },
    ],
  },
  {
    name: 'Bengaluru East',
    k_name: 'ಬೆಂಗಳೂರು ಪೂರ್ವ ಪಾಲಿಕೆ',
    taluks: [
      { name: 'Mahadevapura', k_name: 'ಮಹಾದೇವಪುರ' },
      { name: 'K.R. Puram', k_name: 'ಕೆ.ಆರ್. ಪುರಂ' },
    ],
  },
  {
    name: 'Bengaluru North',
    k_name: 'ಬೆಂಗಳೂರು ಉತ್ತರ ಪಾಲಿಕೆ',
    taluks: [
      { name: 'Byatarayanapura', k_name: 'ಬ್ಯಾಟರಾಯನಪುರ' },
      { name: 'Pulakeshinagar', k_name: 'ಪುಲಿಕೇಶಿನಗರ' },
      { name: 'Sarvagnanagar', k_name: 'ಸರ್ವಜ್ಞನಗರ' },
      { name: 'Hebbal', k_name: 'ಹೆಬ್ಬಾಳ' },
      { name: 'Yelahanka', k_name: 'ಯಲಹಂಕ' },
      { name: 'Dasarahalli', k_name: 'ದಾಸರಹಳ್ಳಿ' },
    ],
  },
  {
    name: 'Bengaluru South',
    k_name: 'ಬೆಂಗಳೂರು ದಕ್ಷಿಣ ಪಾಲಿಕೆ',
    taluks: [
      { name: 'Jayanagar', k_name: 'ಜಯನಗರ' },
      { name: 'Bengaluru South', k_name: 'ಬೆಂಗಳೂರು ದಕ್ಷಿಣ' },
      { name: 'B.T.M Layout', k_name: 'ಬಿ.ಟಿ.ಎಂ ಲೇಔಟ್' },
      { name: 'Bommanahalli', k_name: 'ಬೊಮ್ಮನಹಳ್ಳಿ' },
      { name: 'Padmanabhanagar', k_name: 'ಪದ್ಮನಾಭನಗರ' },
      { name: 'Rajarajeshwari Nagar', k_name: 'ರಾಜರಾಜೇಶ್ವರಿ ನಗರ' },
      { name: 'Anekal', k_name: 'ಆನೇಕಲ್' },
    ],
  },
  {
    name: 'Bengaluru West',
    k_name: 'ಬೆಂಗಳೂರು ಪಶ್ಚಿಮ ಪಾಲಿಕೆ',
    taluks: [
      { name: 'Malleshwaram', k_name: 'ಮಲ್ಲೇಶ್ವರಂ' },
      { name: 'Rajajinagar', k_name: 'ರಾಜಾಜಿನಗರ' },
      { name: 'Mahalakshmi Layout', k_name: 'ಮಹಾಲಕ್ಷ್ಮಿ ಲೇಔಟ್' },
      { name: 'Govindarajanagar', k_name: 'ಗೋವಿಂದರಾಜನಗರ' },
      { name: 'Vijayanagar', k_name: 'ವಿಜಯನಗರ' },
      { name: 'Basavanagudi', k_name: 'ಬಸವನಗುಡಿ' },
      { name: 'Yeshwanthpur', k_name: 'ಯಶವಂತಪುರ' },
    ],
  },
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findDistrictByName(name) {
  return District.findOne({
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
  });
}

async function findTalukByNameInDistrict(districtId, name) {
  return Taluk.findOne({
    district: districtId,
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
  });
}

async function nextDistrictId() {
  const latest = await District.findOne().sort({ district_id: -1 }).select('district_id').lean();
  return (latest?.district_id || 0) + 1;
}

async function nextTalukId() {
  const latest = await Taluk.findOne().sort({ taluk_id: -1 }).select('taluk_id').lean();
  return (latest?.taluk_id || 0) + 1;
}

async function ensureDistrict(entry) {
  const existing = await findDistrictByName(entry.name);
  if (existing) {
    console.log(`✓ District exists (unchanged): ${existing.name}`);
    return { district: existing, created: false };
  }

  const district = await District.create({
    name: entry.name,
    k_name: entry.k_name,
    district_id: await nextDistrictId(),
    is_active: true,
    is_archived: false,
  });
  console.log(`+ Created district: ${district.name} (${district.k_name})`);
  return { district, created: true };
}

async function ensureTaluk(district, talukEntry) {
  const existing = await findTalukByNameInDistrict(district._id, talukEntry.name);
  if (existing) {
    console.log(`  ✓ Taluk exists (unchanged): ${existing.name}`);
    return { created: false };
  }

  const taluk = await Taluk.create({
    name: talukEntry.name,
    k_name: talukEntry.k_name,
    district: district._id,
    taluk_id: await nextTalukId(),
    is_active: true,
    is_archived: false,
  });
  console.log(`  + Created taluk: ${taluk.name} (${taluk.k_name})`);
  return { created: true };
}

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error('DB_URL is missing in .env');
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  console.log('Connected. Adding Bengaluru palike districts/taluks (safe / idempotent)...\n');

  let districtsCreated = 0;
  let taluksCreated = 0;

  for (const entry of DATA) {
    const { district, created } = await ensureDistrict(entry);
    if (created) districtsCreated += 1;

    for (const talukEntry of entry.taluks) {
      const result = await ensureTaluk(district, talukEntry);
      if (result.created) taluksCreated += 1;
    }
    console.log('');
  }

  console.log('Done.');
  console.log(`Districts created: ${districtsCreated}`);
  console.log(`Taluks created: ${taluksCreated}`);
  console.log('Existing districts/taluks were not modified.');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

/**
 * Migrate Bengaluru urban / Bengaluru-taluk memberships to corporation
 * districts+taluks using address text (keywords + pincode).
 *
 * Usage:
 *   node scripts/migrateBengaluruUrbanByAddress.js --dry-run
 *   node scripts/migrateBengaluruUrbanByAddress.js --apply
 *
 * Always writes an Excel report. --apply performs DB updates.
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
const URBAN_DISTRICT_ID = '655c8c7ad50c7eac364960f6';
const URBAN_BENGALURU_TALUK_ID = '6763aa4814b1553ecbd8aecf';

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPincode(address = '') {
  const raw = String(address);
  // Allow spaces inside pincode: "560 006"
  const spaced = raw.match(/\b(560)\s*(\d)\s*(\d)\s*(\d)\b/) || raw.match(/\b(562)\s*(\d)\s*(\d)\s*(\d)\b/);
  if (spaced) return `${spaced[1]}${spaced[2]}${spaced[3]}${spaced[4]}`;

  const full = raw.match(/\b(560\d{3}|562\d{3})\b/);
  if (full) return full[1];

  // "Bangalore-26", "bengaluru 18", "bangalore 43", "bangalore 96"
  const short = raw.match(
    /\b(?:bangalore|bengaluru|bengluru|bengalore|banglore|bagalore|bangaloe|bangalor)\s*[-:]?\s*(\d{2})\b/i
  );
  if (short) return `5600${short[1]}`;

  const trailing = raw.match(/\b(?:bangalore|bengaluru|bengluru|bengalore|banglore)[^\d]{0,12}(\d{2})\s*$/i);
  if (trailing) return `5600${trailing[1]}`;

  // Kannada city short pin: ಬೆಂಗಳೂರು-26
  const kn = raw.match(/ಬೆಂಗಳೂರು\s*[-:]?\s*(\d{2})\b/);
  if (kn) return `5600${kn[1]}`;

  return '';
}

function getAddress(values = []) {
  for (const v of values || []) {
    const label = String(v.label || '');
    if (/address|ವಿಳಾಸ|adress/i.test(label)) {
      const val = v.value;
      if (val != null && String(val).trim()) return String(val).trim();
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

/**
 * Each rule: { district, taluk, keywords: string[], pincodes?: string[], weight?: number }
 * Longer/more specific keywords should be checked; first highest score wins.
 */
const RULES = [
  // --- North ---
  { district: 'Bengaluru North', taluk: 'Yelahanka', keywords: ['yelahanka', 'ಯಲಹಂಕ', 'yelahanka new town', 'puttenahalli yelahanka', 'gkvk'], pincodes: ['560064', '560106', '560065'] },
  { district: 'Bengaluru North', taluk: 'Dasarahalli', keywords: ['t dasarahalli', 't. dasara', 't dasara', 'dasarahalli', 'ದಾಸರಹಳ್ಳಿ', 'mallasandra', 'mallsandra', 'ಮಲ್ಲಸಂದ್ರ', 'peenya', 'bagalagunte', 'bagalaguntte', 'chikkabanavara', 'medarahalli', 'karekallu', 'thammenahalli', 'abinjanapalya', 'chikkasandra', 'herohalli', 'ಹೇರೋಹಳ್ಳಿ'], pincodes: ['560057', '560058', '560073', '560091'] },
  { district: 'Bengaluru North', taluk: 'Hebbal', keywords: ['hebbal', 'ಹೆಬ್ಬಾಳ', 'hebbala', 'kodigehalli', 'sahakarnagar', 'sahakar nagar', 'sanjay nagar', 'sanjaynagar', 'rmv', 'r m v', 'rmv 2', 'ganganagar', 'ganganagara'], pincodes: ['560024', '560092', '560094'] },
  { district: 'Bengaluru North', taluk: 'Byatarayanapura', keywords: ['byatarayanapura', 'ಬ್ಯಾಟರಾಯನಪುರ', 'jakkur', 'yelahanka hobli', 'thanisandra', 'hennur', 'meenakunte', 'ಮೀನಕುಂಟೆ', 'doddajala', 'ದೊಡ್ಡಜಾಲ'], pincodes: ['560097', '560077'] },
  { district: 'Bengaluru North', taluk: 'Pulakeshinagar', keywords: ['pulakeshinagar', 'ಪುಲಿಕೇಶಿನಗರ', 'rt nagar', 'r.t.nagar', 'r t nagar', 'pottery town', 'benson town', 'jc nagar', 'j c nagar', 'j.c.nagar', 'palace guttahalli', 'palace gutahalli'], pincodes: ['560032', '560006'] },
  { district: 'Bengaluru North', taluk: 'Sarvagnanagar', keywords: ['sarvagnanagar', 'ಸರ್ವಜ್ಞನಗರ', 'cox town', 'frazer town', 'pulikeshi nagar', 'jeevanahalli', 'kalyan nagar', 'kalyana nagar', 'kalyananagar', 'chelikere', 'chelekere', 'challakere', 'banaswadi', 'banasa wadi', 'chikkabanasawadi', 'hrbr', 'bangalore north', 'bengaluru north', 'kadukondahalli', 'arabic college'], pincodes: ['560005', '560084', '560043', '560033', '560045'] },

  // --- East ---
  { district: 'Bengaluru East', taluk: 'K.R. Puram', keywords: ['k.r. puram', 'kr puram', 'k r puram', 'ಕೆ.ಆರ್. ಪುರಂ', 'krishnarajapuram', 'hoodi', 'basavanapura', 'ramamurthy nagar', 'ರಾಮಮೂರ್ತಿನಗರ', 'bhattarahalli', 'doorvani nagar', 'doorvaninagar', 'tin factory', 'jayanthi nagar', 'jayanthinagar', 'jayati nagar', 'ದೊಡ್ಡನೇಕ್ಕುಂದಿ', 'doddanekkundi', 'dodda nakkundi', 'nakkundi'], pincodes: ['560036', '560016', '560049', '560017'] },
  { district: 'Bengaluru East', taluk: 'Mahadevapura', keywords: ['mahadevapura', 'ಮಹಾದೇವಪುರ', 'whitefield', 'marathahalli', 'brookefield', 'kadugodi', 'varthur', 'bellandur', 'sarjapur', 'kundalahalli', 'itpl', 'horamavu', 'vormahu', 'varamavu', 'hormahu', 'jyothi nagar', 'jyoti nagara', 'khajisonnanahalli', 'khajisonnenahalli', 'khjisonannahalli', 'kannamangala', 'bangalore east', 'bengaluru east', 'domlur', 'virgonagar', 'huskur'], pincodes: ['560037', '560066', '560048', '560087', '560103', '560067', '560035', '560071'] },

  // --- South ---
  { district: 'Bengaluru South', taluk: 'Jayanagar', keywords: ['jayanagar', 'ಜಯನಗರ', 'jaya nagar'], pincodes: ['560011', '560041', '560069'] },
  { district: 'Bengaluru South', taluk: 'B.T.M Layout', keywords: ['btm', 'b.t.m', 'ಬಿ.ಟಿ.ಎಂ', 'btm layout', 'madiwala', 'tavarekere'], pincodes: ['560029', '560076'] },
  { district: 'Bengaluru South', taluk: 'Bommanahalli', keywords: ['bommanahalli', 'ಬೊಮ್ಮನಹಳ್ಳಿ', 'hsr layout', 'hsr', 'electronic city', 'begur', 'hongasandra', 'singasandra', 'arekere', 'b.chandrappa', 'b chandrappa', 'chandrappa nagar', 'b.g road', 'bg road', 'b g road'], pincodes: ['560068', '560100', '560102', '560030'] },
  { district: 'Bengaluru South', taluk: 'Padmanabhanagar', keywords: ['padmanabhanagar', 'ಪದ್ಮನಾಭನಗರ', 'banashankari', 'bsk', 'kathriguppe', 'uttarahalli', 'girinagar', 'jp nagar', 'j p nagar', 'ಜೆಪಿ ನಗರ', 'jpnagar', 'marenahalli'], pincodes: ['560070', '560085', '560050', '560061', '560078'] },
  { district: 'Bengaluru South', taluk: 'Rajarajeshwari Nagar', keywords: ['rajarajeshwari', 'ರಾಜರಾಜೇಶ್ವರಿ', 'rr nagar', 'r.r.nagar', 'r r nagar', 'ideal homes', 'bhel layout', 'kengeri', 'ullal', 'ullalu', 'thataguni'], pincodes: ['560098', '560059', '560060', '560072', '560056', '560082'] },
  { district: 'Bengaluru South', taluk: 'Anekal', keywords: ['anekal', 'ಆನೇಕಲ್', 'attibele', 'chandapura', 'jigani', 'bannerughatta', 'kukkanahalli', 'gollahalli'], pincodes: ['562106', '562107', '560105', '562123'] },
  { district: 'Bengaluru South', taluk: 'Bengaluru South', keywords: ['adugodi', 'koramangala', 'ejipura', 'wilson garden', 'lakkasandra', 'madivala', 'bangalore south'], pincodes: ['560034', '560047', '560095'] },

  // --- West ---
  { district: 'Bengaluru West', taluk: 'Malleshwaram', keywords: ['malleshwaram', 'ಮಲ್ಲೇಶ್ವರಂ', 'malleswaram', 'sadashivanagar', 'vyalikaval'], pincodes: ['560003', '560012'] },
  { district: 'Bengaluru West', taluk: 'Rajajinagar', keywords: ['rajajinagar', 'ರಾಜಾಜಿನಗರ', 'raja ji nagar', 'basaveshwaranagar', 'basaveshwara nagar', 'basaveswara nagara', 'ನಂದಿನಿ', 'nandini layout', 'kanteerava nagar'], pincodes: ['560010', '560021', '560044', '560096'] },
  { district: 'Bengaluru West', taluk: 'Mahalakshmi Layout', keywords: ['mahalakshmi layout', 'ಮಹಾಲಕ್ಷ್ಮಿ', 'mahalakshmi'], pincodes: ['560086'] },
  { district: 'Bengaluru West', taluk: 'Govindarajanagar', keywords: ['govindarajanagar', 'ಗೋವಿಂದರಾಜನಗರ', 'govindaraja nagar', 'cholurpalya', 'cholarupalya', 'magadi road', 'vijayanagar magadi', 'k p agrahara', 'cheluvappa', 'binni', 'padarayanapura', 'kastur baa', 'kasturba', 'mysore road'], pincodes: ['560023', '560079', '560039'] },
  { district: 'Bengaluru West', taluk: 'Vijayanagar', keywords: ['vijayanagar', 'ವಿಜಯನಗರ', 'vijayanagara', 'vijaynagara', 'rpc layout', 'maruthi mandir', 'manuvana'], pincodes: ['560040'] },
  { district: 'Bengaluru West', taluk: 'Basavanagudi', keywords: ['basavanagudi', 'ಬಸವನಗುಡಿ', 'gandhibazaar', 'nr colony', 'thyagarajanagar', 'jjr nagar', 'j.j.r', 'jjr', 'ಜೆ ಜೆ ಆರ್', 'jagajeevan', 'jagajivan', 'vs garden', 'v s garden', 'venkataswami', 'venkataswany', 'venkata swamy', 'guddadhahalli', 'guddada halli', 'guddadahalli', 'ಹಳೇಗುಡ್ಡದಹಳ್ಳಿ', 'ಹಳೇಗುಡ್ಡದಹಳ್ಳ', 'devaraj urs', 'devraj urs', 'devarajurs', 'ದೇವರಾಜ', 'rayapuram', 'valmiki nagar', 'ipd salappa', 'idp sallappa', 'sallappa'], pincodes: ['560004', '560019', '560028', '560018', '560026'] },
  { district: 'Bengaluru West', taluk: 'Yeshwanthpur', keywords: ['yeshwanthpur', 'ಯಶವಂತಪುರ', 'yeswanthpur', 'yeshwantpur', 'yashwanth pura', 'yashwanthpur', 'mathikere', 'goraguntepalya', 'jalahalli', 'kn extension'], pincodes: ['560022', '560054', '560055', '560013'] },

  // --- Central ---
  { district: 'Bengaluru Central', taluk: 'Shanthinagar', keywords: ['shanthinagar', 'ಶಾಂತಿನಗರ', 'shanti nagar', 'austin town', 'richmond town'], pincodes: ['560027'] },
  { district: 'Bengaluru Central', taluk: 'C.V. Raman Nagar', keywords: ['c.v. raman', 'cv raman', 'ಸಿ.ವಿ. ರಾಮನ್', 'cvraman', 'indiranagar', 'baiyyappanahalli'], pincodes: ['560093', '560038'] },
  { district: 'Bengaluru Central', taluk: 'Shivajinagar', keywords: ['shivajinagar', 'ಶಿವಾಜಿನಗರ', 'shivaji nagar', 'commercial street', 'ulsoor', 'halasuru'], pincodes: ['560001', '560051', '560008', '560042', '560046'] },
  { district: 'Bengaluru Central', taluk: 'Gandhinagar', keywords: ['gandhinagar', 'ಗಾಂಧಿನಗರ', 'gandhi nagar', 'majestic', 'seshadripuram', 'palace road'], pincodes: ['560009', '560020'] },
  { district: 'Bengaluru Central', taluk: 'Chickpet', keywords: ['chickpet', 'ಚಿಕ್ಕಪೇಟೆ', 'akkipet', 'nagrathpet', 'avenue road', 'cottonpet'], pincodes: ['560002', '560053'] },
  { district: 'Bengaluru Central', taluk: 'Chamarajapet', keywords: ['chamarajapet', 'ಚಾಮರಾಜಪೇಟೆ', 'chamrajpet', 'chamarajpet', 'azad nagar', 'kalasipalya'], pincodes: ['560018'] },

  // --- Rural (wrongly stored under urban) ---
  { district: 'Bengaluru rural', taluk: 'Hoskote', keywords: ['hoskote', 'hosakote', 'ಹೊಸಕೋಟೆ'], pincodes: ['562114'] },
  { district: 'Bengaluru rural', taluk: 'Doddaballapura', keywords: ['doddaballapura', 'doddballapura', 'ದೊಡ್ಡಬಳ್ಳಾಪುರ', 'durgapura'], pincodes: ['561203'] },
  { district: 'Bengaluru rural', taluk: 'Devanahalli', keywords: ['devanahalli', 'ದೇವನಹಳ್ಳಿ'], pincodes: ['562110'] },
  { district: 'Bengaluru rural', taluk: 'Nelamangala', keywords: ['nelamangala', 'ನೆಲಮಂಗಲ', 'thippagondanahalli', 'tavrekere', 'bethanagere'], pincodes: ['562130', '562120', '562162'] },
];

function classifyAddress(address) {
  const text = normalize(address);
  const pin = extractPincode(address);
  if (!text && !pin) {
    return { matched: false, reason: 'empty_address', score: 0 };
  }

  let best = null;

  for (const rule of RULES) {
    let score = 0;
    const matchedKeywords = [];

    for (const kw of rule.keywords) {
      const nkw = normalize(kw);
      if (nkw && text.includes(nkw)) {
        score += Math.max(2, nkw.length / 4);
        matchedKeywords.push(kw);
      }
    }

    if (pin && rule.pincodes && rule.pincodes.includes(pin)) {
      score += 8;
      matchedKeywords.push(`pin:${pin}`);
    }

    if (score > 0 && (!best || score > best.score)) {
      best = {
        matched: true,
        districtName: rule.district,
        talukName: rule.taluk,
        score,
        matchedKeywords: matchedKeywords.join(', '),
        pincode: pin,
        reason: 'keyword_or_pincode',
      };
    }
  }

  if (best) return best;

  // Soft pincode-only regional fallbacks (district + default taluk)
  const PIN_FALLBACK = [
    { prefix: ['560064', '560106', '560065'], district: 'Bengaluru North', taluk: 'Yelahanka' },
    { prefix: ['560057', '560058', '560073', '560091'], district: 'Bengaluru North', taluk: 'Dasarahalli' },
    { prefix: ['560024', '560092', '560097', '560094'], district: 'Bengaluru North', taluk: 'Hebbal' },
    { prefix: ['560032', '560006'], district: 'Bengaluru North', taluk: 'Pulakeshinagar' },
    { prefix: ['560005', '560084', '560043', '560033', '560045'], district: 'Bengaluru North', taluk: 'Sarvagnanagar' },
    { prefix: ['560036', '560016', '560049', '560017'], district: 'Bengaluru East', taluk: 'K.R. Puram' },
    { prefix: ['560037', '560066', '560048', '560087', '560103', '560067', '560035', '560071'], district: 'Bengaluru East', taluk: 'Mahadevapura' },
    { prefix: ['560011', '560041', '560069'], district: 'Bengaluru South', taluk: 'Jayanagar' },
    { prefix: ['560029', '560076'], district: 'Bengaluru South', taluk: 'B.T.M Layout' },
    { prefix: ['560068', '560100', '560102', '560030'], district: 'Bengaluru South', taluk: 'Bommanahalli' },
    { prefix: ['560070', '560085', '560050', '560061', '560078'], district: 'Bengaluru South', taluk: 'Padmanabhanagar' },
    { prefix: ['560098', '560059', '560060', '560072', '560056', '560082'], district: 'Bengaluru South', taluk: 'Rajarajeshwari Nagar' },
    { prefix: ['562106', '562107', '560105', '562123'], district: 'Bengaluru South', taluk: 'Anekal' },
    { prefix: ['560034', '560047', '560095'], district: 'Bengaluru South', taluk: 'Bengaluru South' },
    { prefix: ['560003', '560012'], district: 'Bengaluru West', taluk: 'Malleshwaram' },
    { prefix: ['560010', '560021', '560044', '560096'], district: 'Bengaluru West', taluk: 'Rajajinagar' },
    { prefix: ['560040'], district: 'Bengaluru West', taluk: 'Vijayanagar' },
    { prefix: ['560004', '560019', '560028', '560018', '560026'], district: 'Bengaluru West', taluk: 'Basavanagudi' },
    { prefix: ['560022', '560054', '560055', '560013'], district: 'Bengaluru West', taluk: 'Yeshwanthpur' },
    { prefix: ['560023', '560079', '560039'], district: 'Bengaluru West', taluk: 'Govindarajanagar' },
    { prefix: ['560086'], district: 'Bengaluru West', taluk: 'Mahalakshmi Layout' },
    { prefix: ['560027'], district: 'Bengaluru Central', taluk: 'Shanthinagar' },
    { prefix: ['560001', '560051', '560008', '560042', '560046'], district: 'Bengaluru Central', taluk: 'Shivajinagar' },
    { prefix: ['560009', '560020'], district: 'Bengaluru Central', taluk: 'Gandhinagar' },
    { prefix: ['560002', '560053'], district: 'Bengaluru Central', taluk: 'Chickpet' },
    { prefix: ['562130', '562120', '562162'], district: 'Bengaluru rural', taluk: 'Nelamangala' },
  ];

  if (pin) {
    for (const fb of PIN_FALLBACK) {
      if (fb.prefix.includes(pin)) {
        return {
          matched: true,
          districtName: fb.district,
          talukName: fb.taluk,
          score: 5,
          matchedKeywords: `pin_fallback:${pin}`,
          pincode: pin,
          reason: 'pincode_fallback',
        };
      }
    }
  }

  // Last resort so every card can leave Bengaluru urban without data loss.
  // Flagged in Excel as last_resort_* for manual review if needed.
  const hasBlr =
    /bangalore|bengaluru|bengluru|bengalore|banglore|ಬೆಂಗಳೂರು/i.test(address || '');
  if (hasBlr) {
    return {
      matched: true,
      districtName: 'Bengaluru West',
      talukName: 'Basavanagudi',
      score: 1,
      matchedKeywords: 'last_resort_bangalore_mention',
      pincode: pin,
      reason: 'last_resort_bangalore',
    };
  }

  return {
    matched: true,
    districtName: 'Bengaluru Central',
    talukName: 'Gandhinagar',
    score: 1,
    matchedKeywords: 'last_resort_no_locality',
    pincode: pin,
    reason: 'last_resort_other',
  };
}

async function resolveTargets() {
  const districts = await District.find({
    name: {
      $in: [
        'Bengaluru Central',
        'Bengaluru East',
        'Bengaluru North',
        'Bengaluru South',
        'Bengaluru West',
        'Bengaluru rural',
      ],
    },
    is_archived: { $ne: true },
  }).lean();

  const byName = {};
  for (const d of districts) byName[d.name] = d;

  const needed = [
    'Bengaluru Central',
    'Bengaluru East',
    'Bengaluru North',
    'Bengaluru South',
    'Bengaluru West',
    'Bengaluru rural',
  ];
  for (const n of needed) {
    if (!byName[n]) throw new Error(`Missing target district: ${n}`);
  }

  const taluks = await Taluk.find({
    district: { $in: districts.map((d) => d._id) },
    is_archived: { $ne: true },
  }).lean();

  const talukMap = {}; // `${districtName}||${talukNameLower}` -> taluk
  for (const t of taluks) {
    const dist = districts.find((d) => String(d._id) === String(t.district));
    if (!dist) continue;
    talukMap[`${dist.name}||${normalize(t.name)}`] = t;
  }

  return { byName, talukMap };
}

function findTargetTaluk(talukMap, districtName, talukName) {
  return talukMap[`${districtName}||${normalize(talukName)}`] || null;
}

async function writeExcel(rows, summary, outPath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Migration Report');
  ws.columns = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Membership ID', key: 'membershipId', width: 16 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Payment Status', key: 'paymentStatus', width: 14 },
    { header: 'Address', key: 'address', width: 55 },
    { header: 'Pincode', key: 'pincode', width: 10 },
    { header: 'From District', key: 'fromDistrict', width: 18 },
    { header: 'From Taluk', key: 'fromTaluk', width: 14 },
    { header: 'To District', key: 'toDistrict', width: 20 },
    { header: 'To Taluk', key: 'toTaluk', width: 22 },
    { header: 'Match Score', key: 'score', width: 12 },
    { header: 'Matched On', key: 'matchedKeywords', width: 35 },
    { header: 'Reason', key: 'reason', width: 18 },
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
    if (r.status === 'MIGRATED' || r.status === 'WOULD_MIGRATE') {
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
  console.log(APPLY ? 'APPLY mode — will update DB' : 'DRY-RUN mode — no DB writes');

  const urban = await District.findById(URBAN_DISTRICT_ID);
  const bengTaluk = await Taluk.findById(URBAN_BENGALURU_TALUK_ID);
  if (!urban || !bengTaluk) throw new Error('Bengaluru urban / Bengaluru taluk not found');

  const { byName, talukMap } = await resolveTargets();

  const submissions = await MembershipSubmission.find({
    district: urban._id,
    taluk: bengTaluk._id,
  })
    .select('membershipId values paymentResult district taluk')
    .lean();

  console.log(`Loaded ${submissions.length} memberships under Bengaluru urban / Bengaluru`);

  const rows = [];
  let wouldMigrate = 0;
  let migrated = 0;
  let unmatched = 0;
  let missingTarget = 0;
  let errors = 0;

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    const address = getAddress(sub.values);
    const name = getName(sub.values);
    const classification = classifyAddress(address);

    const base = {
      sno: i + 1,
      membershipId: sub.membershipId || String(sub._id),
      name,
      paymentStatus: sub.paymentResult?.status || '',
      address,
      pincode: classification.pincode || extractPincode(address),
      fromDistrict: urban.name,
      fromTaluk: bengTaluk.name,
      toDistrict: classification.districtName || '',
      toTaluk: classification.talukName || '',
      score: classification.score || 0,
      matchedKeywords: classification.matchedKeywords || '',
      reason: classification.reason || '',
      status: '',
    };

    if (!classification.matched) {
      unmatched += 1;
      base.status = 'UNMATCHED';
      rows.push(base);
      continue;
    }

    const targetDistrict = byName[classification.districtName];
    const targetTaluk = findTargetTaluk(talukMap, classification.districtName, classification.talukName);

    if (!targetDistrict || !targetTaluk) {
      missingTarget += 1;
      base.status = 'MISSING_TARGET';
      base.reason = `missing_target:${classification.districtName}/${classification.talukName}`;
      rows.push(base);
      continue;
    }

    base.toDistrict = targetDistrict.name;
    base.toTaluk = targetTaluk.name;

    if (!APPLY) {
      wouldMigrate += 1;
      base.status = 'WOULD_MIGRATE';
      rows.push(base);
      continue;
    }

    try {
      const result = await MembershipSubmission.updateOne(
        { _id: sub._id, district: urban._id, taluk: bengTaluk._id },
        { $set: { district: targetDistrict._id, taluk: targetTaluk._id } }
      );
      if (result.modifiedCount === 1 || result.matchedCount === 1) {
        migrated += 1;
        base.status = 'MIGRATED';
      } else {
        errors += 1;
        base.status = 'UPDATE_FAILED';
        base.reason = 'no_document_updated';
      }
    } catch (e) {
      errors += 1;
      base.status = 'ERROR';
      base.reason = e.message;
    }
    rows.push(base);

    if ((i + 1) % 100 === 0) console.log(`Processed ${i + 1}/${submissions.length}`);
  }

  const remaining = await MembershipSubmission.countDocuments({
    district: urban._id,
    taluk: bengTaluk._id,
  });

  const summary = {
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    total_loaded: submissions.length,
    completed_among_loaded: submissions.filter((s) => s.paymentResult?.status === 'COMPLETED').length,
    would_migrate: wouldMigrate,
    migrated,
    unmatched,
    missing_target: missingTarget,
    errors,
    remaining_under_urban_bengaluru_taluk: remaining,
    generated_at: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(
    outDir,
    `bengaluru_urban_migration_${APPLY ? 'applied' : 'dryrun'}_${stamp}.xlsx`
  );
  await writeExcel(rows, summary, outPath);

  console.log('\nSummary:', summary);
  console.log('Excel report:', outPath);

  await mongoose.disconnect();

  if (APPLY && remaining > 0) {
    console.log(`\nNOTE: ${remaining} still remain under Bengaluru urban/Bengaluru (unmatched or failed). Do NOT delete yet.`);
  }
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

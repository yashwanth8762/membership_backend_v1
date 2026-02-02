const xlsx = require('xlsx');

const filePath = './data2.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log('\n=== ALL COLUMN NAMES IN YOUR EXCEL ===');
if (data.length > 0) {
  Object.keys(data[0]).forEach((key, index) => {
    console.log(`${index + 1}. "${key}"`);
  });
}

console.log('\n=== FIRST ROW DATA ===');
console.log(JSON.stringify(data[0], null, 2));

console.log('\n=== CHECKING FOR PHOTO COLUMN ===');
const photoColumns = Object.keys(data[0]).filter(key => 
  key.toLowerCase().includes('photo') || 
  key.toLowerCase().includes('pic') || 
  key.includes('ಛಾಯಾಚಿತ್ರ')
);
console.log('Photo-related columns found:', photoColumns);

if (photoColumns.length > 0) {
  photoColumns.forEach(col => {
    console.log(`\nColumn "${col}" - First 5 values:`);
    data.slice(0, 5).forEach((row, idx) => {
      console.log(`  Row ${idx + 1}: "${row[col]}"`);
    });
  });
}
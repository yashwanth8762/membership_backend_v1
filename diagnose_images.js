const ExcelJS = require('exceljs');

async function diagnoseImagePositions(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet(1);
  
  console.log('\n=== DIAGNOSTIC REPORT ===\n');
  
  // Get all images
  const images = worksheet.getImages();
  console.log(`Total images found: ${images.length}\n`);
  
  // Analyze image positions
  const imagesByRow = {};
  const imagePositions = [];
  
  images.forEach((image, index) => {
    const imageId = image.imageId;
    const imageData = workbook.model.media.find(m => m.index === imageId);
    
    if (imageData && imageData.buffer) {
      const rowIndex = image.range.tl.row;
      const colIndex = image.range.tl.col;
      
      if (!imagesByRow[rowIndex]) {
        imagesByRow[rowIndex] = 0;
      }
      imagesByRow[rowIndex]++;
      
      imagePositions.push({
        imageNum: index + 1,
        excelRow: rowIndex + 1,  // Human-readable (1-indexed)
        rowIndex: rowIndex,      // 0-indexed
        col: colIndex + 1,
        hasBuffer: true,
        bufferSize: imageData.buffer.length
      });
    }
  });
  
  // Sort by row
  imagePositions.sort((a, b) => a.rowIndex - b.rowIndex);
  
  console.log('=== IMAGE POSITIONS ===');
  console.log('Format: [Image#] Excel Row X (index Y) | Column Z | Size\n');
  imagePositions.forEach(img => {
    console.log(`[${img.imageNum}] Excel Row ${img.excelRow} (index ${img.rowIndex}) | Col ${img.col} | ${img.bufferSize} bytes`);
  });
  
  // Analyze data rows
  console.log('\n=== DATA ROW ANALYSIS ===\n');
  
  let dataRowCount = 0;
  const headers = [];
  const headerRow = worksheet.getRow(1);
  
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = cell.value?.toString().trim() || `Column${colNumber}`;
  });
  
  console.log(`Headers found in row 1: ${headers.filter(h => h).length} columns`);
  console.log(`Header row columns: ${headers.filter(h => h).join(', ')}\n`);
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    dataRowCount++;
  });
  
  console.log(`Total data rows (excluding header): ${dataRowCount}`);
  console.log(`Data rows range: Excel rows 2-${dataRowCount + 1}`);
  console.log(`Data rows range (0-indexed): indices 1-${dataRowCount}\n`);
  
  // Show which data rows have images
  console.log('=== ROWS WITH IMAGES ===\n');
  const sortedRowIndices = Object.keys(imagesByRow).map(Number).sort((a, b) => a - b);
  
  console.log(`Rows with images (0-indexed): ${sortedRowIndices.join(', ')}\n`);
  
  sortedRowIndices.forEach(rowIndex => {
    const excelRow = rowIndex + 1;
    const dataRowNum = rowIndex; // Since row 0 is header, row 1 is first data row
    console.log(`Excel Row ${excelRow} (index ${rowIndex}) = Data row ${dataRowNum} | ${imagesByRow[rowIndex]} image(s)`);
  });
  
  // Check for gaps
  console.log('\n=== CHECKING FOR ISSUES ===\n');
  
  // Find rows with images that are outside data range
  const imagesOutsideData = sortedRowIndices.filter(idx => idx < 1 || idx > dataRowCount);
  if (imagesOutsideData.length > 0) {
    console.log(`⚠ WARNING: ${imagesOutsideData.length} images are outside the data range!`);
    console.log(`Indices: ${imagesOutsideData.join(', ')}`);
  }
  
  // Find rows with images in header
  const imagesInHeader = sortedRowIndices.filter(idx => idx === 0);
  if (imagesInHeader.length > 0) {
    console.log(`⚠ WARNING: ${imagesByRow[0]} image(s) found in header row (index 0)!`);
  }
  
  // Show data rows WITHOUT images
  const dataRowsWithoutImages = [];
  for (let i = 1; i <= dataRowCount; i++) {
    if (!imagesByRow[i]) {
      dataRowsWithoutImages.push(i);
    }
  }
  
  if (dataRowsWithoutImages.length > 0) {
    console.log(`\n⚠ ${dataRowsWithoutImages.length} data rows have NO images`);
    console.log(`First 20 rows without images (0-indexed): ${dataRowsWithoutImages.slice(0, 20).join(', ')}`);
  }
  
  // Show mapping suggestion
  console.log('\n=== CORRECT MAPPING ===\n');
  console.log('When processing data rows, use this logic:');
  console.log('');
  console.log('row._excelRowNumber = actual Excel row number (e.g., 2, 3, 4...)');
  console.log('imageRowIndex = row._excelRowNumber - 1 (e.g., 1, 2, 3...)');
  console.log('Then look up: imagesByRow[imageRowIndex]');
  console.log('');
  console.log('Example for first data row:');
  console.log('  Excel Row 2 → _excelRowNumber = 2 → imageRowIndex = 1 → lookup imagesByRow[1]');
  
  console.log('\n=== SAMPLE DATA ROWS ===\n');
  
  // Show first few data rows with their Excel row numbers
  let sampleCount = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || sampleCount >= 10) return;
    
    const imageCount = imagesByRow[rowNumber - 1] || 0;
    const rowData = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header && colNumber <= 3) { // Show first 3 columns only
        rowData[header] = cell.value?.toString().substring(0, 30);
      }
    });
    
    console.log(`Excel Row ${rowNumber} (index ${rowNumber - 1}) | ${imageCount} image(s)`);
    console.log(`  Data: ${JSON.stringify(rowData).substring(0, 100)}...`);
    sampleCount++;
  });
  
  console.log('\n=== END DIAGNOSTIC ===\n');
}

// Run diagnostic
(async () => {
  const filePath = './data2.xlsx';
  try {
    await diagnoseImagePositions(filePath);
  } catch (error) {
    console.error('Error:', error);
  }
})();

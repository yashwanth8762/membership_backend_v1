// const mongoose = require('mongoose');
// const ExcelJS = require('exceljs');
// const fs = require('fs');
// const path = require('path');
// const sharp = require('sharp');
// const District = require('./Modals/District');
// const Taluk = require('./Modals/Taluk');
// const Media = require('./Modals/Media');
// const MediaType = require('./Modals/MediaType');
// const { MembershipSubmission, MembershipForm, MembershipCounter } = require('./Modals/Membership');

// const DB_URL = "mongodb://localhost:27017/Membership";

// // Add concurrency limit for image processing
// const CONCURRENT_IMAGE_LIMIT = 5;

// async function connectDB() {
//   try {
//     await mongoose.connect(DB_URL);
//     console.log('Connected to MongoDB');
//   } catch (error) {
//     console.error('Error connecting to MongoDB:', error);
//     process.exit(1);
//   }
// }

// // Extract images from Excel using ExcelJS - IMPROVED
// async function extractImagesFromExcel(filePath) {
//   const workbook = new ExcelJS.Workbook();
//   await workbook.xlsx.readFile(filePath);
  
//   const worksheet = workbook.getWorksheet(1);
//   const imagesByRow = {};
  
//   console.log('\n=== Extracting Embedded Images ===');
  
//   // Get all images from worksheet
//   const images = worksheet.getImages();
//   console.log(`Found ${images.length} total images in worksheet`);
  
//   images.forEach((image, index) => {
//     try {
//       const imageId = image.imageId;
//       const imageData = workbook.model.media.find(m => m.index === imageId);
      
//       if (imageData && imageData.buffer) {
//         // ExcelJS rows are 0-indexed, but we need to match with data rows (which skip header)
//         // image.range.tl.row is 0-indexed
//         const row = image.range.tl.row;
        
//         if (!imagesByRow[row]) {
//           imagesByRow[row] = [];
//         }
        
//         imagesByRow[row].push({
//           data: Buffer.from(imageData.buffer), // Ensure it's a proper Buffer
//           extension: imageData.extension || 'png',
//           name: imageData.name || `image_${row}_${index}`,
//           col: image.range.tl.col
//         });
        
//         console.log(`  [${index + 1}/${images.length}] Found image in row ${row + 1}, col ${image.range.tl.col + 1}`);
//       } else {
//         console.warn(`  [${index + 1}/${images.length}] Warning: Image ${imageId} has no buffer data`);
//       }
//     } catch (error) {
//       console.error(`  Error processing image ${index}: ${error.message}`);
//     }
//   });
  
//   console.log(`✓ Extracted ${Object.keys(imagesByRow).length} rows with images`);
//   console.log(`Total images: ${Object.values(imagesByRow).reduce((sum, imgs) => sum + imgs.length, 0)}`);
//   console.log('===================================\n');
  
//   return imagesByRow;
// }

// // Read Excel data as JSON
// async function readExcelData(filePath) {
//   const workbook = new ExcelJS.Workbook();
//   await workbook.xlsx.readFile(filePath);
  
//   const worksheet = workbook.getWorksheet(1);
//   const data = [];
  
//   const headers = [];
//   const headerRow = worksheet.getRow(1);
//   headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
//     headers[colNumber] = cell.value?.toString().trim() || `Column${colNumber}`;
//   });
  
//   worksheet.eachRow((row, rowNumber) => {
//     if (rowNumber === 1) return;
    
//     const rowData = {};
//     row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
//       const header = headers[colNumber];
//       if (header) {
//         let value = cell.value;
        
//         if (value instanceof Date) {
//           value = value.toLocaleDateString('en-GB');
//         } else if (cell.type === ExcelJS.ValueType.Date) {
//           value = cell.value.toLocaleDateString('en-GB');
//         } else if (value && typeof value === 'object' && value.text) {
//           value = value.text;
//         }
        
//         rowData[header] = value?.toString().trim() || '';
//       }
//     });
    
//     rowData._excelRowNumber = rowNumber;
//     data.push(rowData);
//   });
  
//   return data;
// }

// function normalizeString(value) {
//   if (!value) return '';
//   return value.toString().trim().normalize('NFC').replace(/\s+/g, ' ');
// }

// // Save extracted image buffer to temp file - IMPROVED
// async function saveImageBuffer(imageBuffer, imageExtension, rowNumber, index = 0) {
//   const tempDir = './assets/temp_resources';
  
//   if (!fs.existsSync(tempDir)) {
//     fs.mkdirSync(tempDir, { recursive: true });
//   }
  
//   const { v4: uuidv4 } = require('uuid');
//   const timestamp = Date.now();
//   const tempFileName = `${uuidv4()}-row${rowNumber}-${timestamp}-${index}.${imageExtension}`;
//   const tempFilePath = path.join(tempDir, tempFileName);
  
//   // Write buffer synchronously to avoid race conditions
//   fs.writeFileSync(tempFilePath, imageBuffer);
  
//   // Verify file was written
//   if (!fs.existsSync(tempFilePath)) {
//     throw new Error(`Failed to write temp file: ${tempFilePath}`);
//   }
  
//   const stats = fs.statSync(tempFilePath);
//   console.log(`    Temp file created: ${tempFileName} (${stats.size} bytes)`);
  
//   return {
//     path: tempFilePath,
//     filename: tempFileName,
//     originalname: `row_${rowNumber}_image_${index}.${imageExtension}`,
//     size: imageBuffer.length
//   };
// }

// // Process image exactly like the media controller does - IMPROVED
// async function processSingleImage(image, rowNumber) {
//   try {
//     let original_file_name_without_extension = image.originalname.split('.');
//     let original_file_extension = original_file_name_without_extension.pop();

//     let current_file_name_without_extension = image.filename.split('.');
//     let current_file_extension = current_file_name_without_extension.pop();

//     let imageToReturn = {
//       name: {
//         original: original_file_name_without_extension[0],
//         current: current_file_name_without_extension[0]
//       },
//       size: {
//         original: image.size,
//         current: 0
//       },
//       extension: {
//         original: current_file_extension,
//         current: ''
//       },
//       image_url: {
//         full: {
//           high_res: '',
//           low_res: '',
//         },
//         thumbnail: {
//           high_res: '',
//           low_res: '',
//         }
//       }
//     };

//     // Verify file exists before processing
//     if (!fs.existsSync(image.path)) {
//       throw new Error(`Source image file not found: ${image.path}`);
//     }

//     const image_metadata = await sharp(image.path).metadata();

//     let set_image_width_as_max_width = false;
//     let is_thumbnail_required = false;

//     if (image_metadata.width > 1500) {
//       set_image_width_as_max_width = true;
//     } else if (image_metadata.width > 500) {
//       is_thumbnail_required = true;
//     }

//     const image_url = image.path.replace(/\\/g, "/");
//     const url_array = image_url.split("/");
//     const file_name_with_ext = url_array[url_array.length - 1];
//     const file_name_without_ext = file_name_with_ext.replace(/\.[^/.]+$/, "");
//     let final_file_name = file_name_without_ext.replaceAll(/\s/g, '');
//     final_file_name = final_file_name.replace(/[{()}]/g, "");

//     // Ensure directories exist
//     const dirs = [
//       'assets/images/full/high_res',
//       'assets/images/full/low_res',
//       'assets/images/thumb/high_res',
//       'assets/images/thumb/low_res'
//     ];
    
//     dirs.forEach(dir => {
//       if (!fs.existsSync(dir)) {
//         fs.mkdirSync(dir, { recursive: true });
//       }
//     });

//     // Process full high res
//     await sharp(image_url)
//       .resize({ width: set_image_width_as_max_width ? 1500 : image_metadata.width })
//       .toFormat('webp')
//       .webp({ quality: 80 })
//       .toFile(`assets/images/full/high_res/${final_file_name}.webp`);

//     imageToReturn.image_url.full.high_res = `assets/images/full/high_res/${final_file_name}.webp`;

//     // Process full low res
//     await sharp(image_url)
//       .resize({ width: set_image_width_as_max_width ? 1500 : image_metadata.width })
//       .toFormat('webp')
//       .webp({ quality: 60 })
//       .toFile(`assets/images/full/low_res/${final_file_name}.webp`);

//     imageToReturn.image_url.full.low_res = `assets/images/full/low_res/${final_file_name}.webp`;

//     if (is_thumbnail_required) {
//       await sharp(imageToReturn.image_url.full.high_res)
//         .resize({ width: 250, height: 250, fit: 'contain', background: "#f1f5f9" })
//         .toFormat('webp')
//         .webp({ quality: 100 })
//         .toFile(`assets/images/thumb/high_res/${final_file_name}.webp`);

//       imageToReturn.image_url.thumbnail.high_res = `assets/images/thumb/high_res/${final_file_name}.webp`;

//       await sharp(imageToReturn.image_url.full.low_res)
//         .resize({ width: 250, height: 250, fit: 'contain', background: "#f1f5f9" })
//         .toFormat('webp')
//         .webp({ quality: 70 })
//         .toFile(`assets/images/thumb/low_res/${final_file_name}.webp`);

//       imageToReturn.image_url.thumbnail.low_res = `assets/images/thumb/low_res/${final_file_name}.webp`;
//     } else {
//       imageToReturn.image_url.thumbnail.high_res = imageToReturn.image_url.full.high_res;
//       imageToReturn.image_url.thumbnail.low_res = imageToReturn.image_url.full.low_res;
//     }

//     let optimized_file_metadata = await sharp(imageToReturn.image_url.full.high_res).metadata();
//     imageToReturn.extension.current = optimized_file_metadata.format;
    
//     let optimized_image = fs.statSync(imageToReturn.image_url.full.high_res);
//     imageToReturn.size.current = optimized_image.size;

//     // Delete original temp file
//     try {
//       if (fs.existsSync(image.path)) {
//         fs.unlinkSync(image.path);
//         console.log(`    Cleaned up temp file: ${image.filename}`);
//       }
//     } catch (error) {
//       console.warn(`    Warning: Could not delete temp file: ${error.message}`);
//     }

//     return {
//       status: true,
//       data: imageToReturn
//     };
//   } catch (error) {
//     console.error(`    ❌ Error in processSingleImage for row ${rowNumber}: ${error.message}`);
//     // Clean up temp file on error
//     try {
//       if (image.path && fs.existsSync(image.path)) {
//         fs.unlinkSync(image.path);
//       }
//     } catch (cleanupError) {
//       console.warn(`    Warning: Could not cleanup temp file: ${cleanupError.message}`);
//     }
//     return {
//       status: false,
//       error: error.message
//     };
//   }
// }

// // Create media entry in database - IMPROVED
// async function createMediaEntry(processedImage, imageMediaTypeId) {
//   try {
//     let new_media = {
//       name: {
//         temp: processedImage.data.name.current,
//         original: processedImage.data.name.original,
//         current: processedImage.data.name.current,
//         history: []
//       },
//       extension: {
//         original: processedImage.data.extension.original,
//         current: processedImage.data.extension.current
//       },
//       size: {
//         original: processedImage.data.size.original,
//         current: processedImage.data.size.current
//       },
//       image_url: {
//         full: {
//           high_res: processedImage.data.image_url.full.high_res,
//           low_res: processedImage.data.image_url.full.low_res,
//         },
//         thumbnail: {
//           high_res: processedImage.data.image_url.thumbnail.high_res,
//           low_res: processedImage.data.image_url.thumbnail.low_res,
//         }
//       },
//       doc_url: undefined,
//       video_url: {
//         video: {
//           high_res: undefined,
//           low_res: undefined,
//         },
//         thumbnail: {
//           high_res: undefined,
//           low_res: undefined,
//         }
//       },
//       other_file_url: undefined,
//       media_type: imageMediaTypeId,
//       uploaded_by: null,
//     };

//     let save_media = new Media(new_media);
//     const savedMedia = await save_media.save();
    
//     return savedMedia._id;
//   } catch (error) {
//     console.error(`    ❌ Error saving media to database: ${error.message}`);
//     throw error;
//   }
// }

// // Handle embedded image from Excel - IMPROVED
// async function handleEmbeddedImage(imageData, rowNumber, imageIndex = 0) {
//   try {
//     console.log(`    Processing image ${imageIndex + 1} for row ${rowNumber}...`);
    
//     // Get or create image media type
//     let imageMediaType = await MediaType.findOne({ name: 'image' });
//     if (!imageMediaType) {
//       console.log('    Creating image media type...');
//       imageMediaType = await MediaType.create({ 
//         name: 'image',
//         is_archived: false 
//       });
//     }

//     // Validate buffer
//     if (!imageData.data || imageData.data.length === 0) {
//       console.error(`    ❌ Invalid image buffer for row ${rowNumber}`);
//       return null;
//     }

//     console.log(`    Image buffer size: ${imageData.data.length} bytes`);

//     // Save buffer to temp file
//     const tempFileInfo = await saveImageBuffer(
//       imageData.data, 
//       imageData.extension, 
//       rowNumber,
//       imageIndex
//     );
    
//     // Process the image
//     const processedImage = await processSingleImage(tempFileInfo, rowNumber);

//     if (!processedImage.status) {
//       console.error(`    ❌ Failed to process image: ${processedImage.error}`);
//       return null;
//     }

//     // Create media entry in database
//     const mediaId = await createMediaEntry(processedImage, imageMediaType._id);
    
//     console.log(`    ✓✓ Image successfully saved! Media ID: ${mediaId}`);

//     return mediaId;

//   } catch (error) {
//     console.error(`    ❌ Error in handleEmbeddedImage for row ${rowNumber}: ${error.message}`);
//     console.error(error.stack);
//     return null;
//   }
// }

// // Process images with concurrency limit
// async function processImagesInBatches(tasks, limit) {
//   const results = [];
//   for (let i = 0; i < tasks.length; i += limit) {
//     const batch = tasks.slice(i, i + limit);
//     const batchResults = await Promise.all(batch.map(task => task()));
//     results.push(...batchResults);
//     console.log(`  Processed batch ${Math.floor(i / limit) + 1}/${Math.ceil(tasks.length / limit)}`);
//   }
//   return results;
// }

// async function importData(filePath, defaultFormId = null) {
//   // Extract images first
//   const imagesByRow = await extractImagesFromExcel(filePath);
  
//   // Read data
//   const data = await readExcelData(filePath);

//   // Debug: Show first row
//   if (data.length > 0) {
//     console.log('\n=== First Row Column Names ===');
//     Object.keys(data[0]).forEach(key => {
//       if (!key.startsWith('_')) {
//         console.log(`"${key}" = "${data[0][key]}"`);
//       }
//     });
//     console.log('==============================\n');
//   }

//   // Get or create form
//   let formId = defaultFormId;
//   if (!formId) {
//     console.log('\nNo formId provided. Looking for existing forms...');
//     const existingForm = await MembershipForm.findOne().sort({ createdAt: -1 });
    
//     if (existingForm) {
//       formId = existingForm._id;
//       console.log(`✓ Using existing form: ${formId}`);
//     } else {
//       console.log('No forms found. Creating default form...');
//       const defaultForm = await MembershipForm.create({
//         fields: [
//           { inputType: 'text', label: 'Name', label_kn: 'ಹೆಸರು', required: true, order: 1 },
//           { inputType: 'text', label: 'Gender', label_kn: 'ಲಿಂಗ', required: true, order: 2 },
//           { inputType: 'text', label: 'Father/Mother/Husband Name', label_kn: 'ತಂದೆ/ತಾಯಿ/ಪತಿ ಹೆಸರು', required: true, order: 3 },
//           { inputType: 'text', label: 'DOB', label_kn: 'ಹುಟ್ಟಿದ ದಿನಾಂಕ', required: true, order: 4 },
//           { inputType: 'text', label: 'Caste', label_kn: 'ಜಾತಿ', required: false, order: 5 },
//           { inputType: 'text', label: 'Subcaste', label_kn: 'ಉಪಜಾತಿ', required: false, order: 6 },
//           { inputType: 'text', label: 'Qualification', label_kn: 'ಅರ್ಹತೆ', required: false, order: 7 },
//           { inputType: 'textarea', label: 'Current Address', label_kn: 'ಪ್ರಸ್ತುತ ವಿಳಾಸ', required: true, order: 8 },
//           { inputType: 'textarea', label: 'Permanent Address', label_kn: 'ಶಾಶ್ವತ ವಿಳಾಸ', required: false, order: 9 },
//           { inputType: 'text', label: 'Mobile Number', label_kn: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ', required: true, order: 10 },
//           { inputType: 'text', label: 'Ward Name', label_kn: 'ವಾರ್ಡ್ ಹೆಸರು', required: false, order: 11 },
//           { inputType: 'text', label: 'Assembly Constituency', label_kn: 'ವಿಧಾನಸಭಾ ಕ್ಷೇತ್ರ', required: false, order: 12 },
//           { inputType: 'number', label: 'Amount', label_kn: 'ಮೊತ್ತ', required: false, order: 13 },
//           { inputType: 'media', label: 'Photos', label_kn: 'ಫೋಟೋಗಳು', required: false, order: 14 },
//         ],
//       });
//       formId = defaultForm._id;
//       console.log(`✓ Created default form: ${formId}`);
//     }
//   }

//   console.log(`\n📋 Using Form ID: ${formId}\n`);

//   let successCount = 0;
//   let failCount = 0;
//   let photoSuccessCount = 0;
//   let photoFailCount = 0;

//   // Process rows SEQUENTIALLY to avoid overwhelming the system
//   const submissions = [];
  
//   for (let index = 0; index < data.length; index++) {
//     const row = data[index];
    
//     try {
//       const districtName = normalizeString(row['District']);
//       const talukName = normalizeString(row['Taluk']);
//       const adharNo = normalizeString(row['Aadhar No.'] || row['Adhar No']);

//       if (!districtName || !talukName) {
//         console.error(`❌ Row ${index + 1}: Skipping - missing District or Taluk`);
//         failCount++;
//         continue;
//       }

//       console.log(`\n${'─'.repeat(60)}`);
//       console.log(`📄 Row ${index + 1}/${data.length} (Excel Row ${row._excelRowNumber})`);
//       console.log(`${'─'.repeat(60)}`);

//       const district = await District.findOne({ 
//         name: { $regex: new RegExp(`^${districtName}$`, 'i') } 
//       });
      
//       if (!district) {
//         console.error(`❌ District not found: "${districtName}"`);
//         failCount++;
//         continue;
//       }

//       const taluk = await Taluk.findOne({ 
//         name: { $regex: new RegExp(`^${talukName}$`, 'i') },
//         district: district._id 
//       });
      
//       if (!taluk) {
//         console.error(`❌ Taluk not found: "${talukName}"`);
//         failCount++;
//         continue;
//       }

//       console.log(`✓ District: "${district.name}", Taluk: "${taluk.name}"`);

//       // Handle embedded image for this row
//       let photoMediaId = null;
//       const excelRowNumber = row._excelRowNumber - 1; // Adjust for 0-indexing
      
//       console.log(`\n📸 Checking for embedded image at row index ${excelRowNumber}...`);
      
//       if (imagesByRow[excelRowNumber] && imagesByRow[excelRowNumber].length > 0) {
//         console.log(`  ✓ Found ${imagesByRow[excelRowNumber].length} embedded image(s)!`);
        
//         // Process first image only (or modify to handle multiple)
//         const imageData = imagesByRow[excelRowNumber][0];
//         photoMediaId = await handleEmbeddedImage(imageData, row._excelRowNumber, 0);
        
//         if (photoMediaId) {
//           photoSuccessCount++;
//           console.log(`  ✓✓ Photo saved successfully for row ${row._excelRowNumber}`);
//         } else {
//           photoFailCount++;
//           console.log(`  ❌ Photo failed to save for row ${row._excelRowNumber}`);
//         }
//       } else {
//         console.log(`  ⚠ No embedded image found for row ${row._excelRowNumber}`);
//         photoFailCount++;
//       }

//       successCount++;

//       // Build values array
//       const values = [
//         { label: 'Membership Amount', value: row['Amount'] || '', media: [] },
//         { 
//           label: 'ಛಾಯಾಚಿತ್ರ /Upload photo', 
//           value: photoMediaId ? [photoMediaId.toString()] : [],
//           media: photoMediaId ? [photoMediaId] : []
//         },
//         { label: 'ಅರ್ಜಿದಾರನ/ಳ ಹೆಸರು/ Applicant Name', value: row['Name'] || row['Name '] || '', media: [] },
//         { label: 'ಲಿಂಗ/Gender', value: row['Gender'] || '', media: [] },
//         { label: 'ತಂದೆ/ತಾಯಿ/ಗಂಡನ ಹೆಸರು / Father/Mother/Husband/Name', value: row['Father/Mother/Husband Name'] || '', media: [] },
//         { label: 'ಜನ್ಮ ದಿನಾಂಕ/Date of Birth', value: row['DOB'] || '', media: [] },
//         { label: 'ಜಾತಿ/Caste', value: row['Caste'] || '', media: [] },
//         { label: 'ಉಪಜಾತಿ /Subcaste', value: row['Subcaste'] || '', media: [] },
//         { label: 'ವಿದ್ಯಾರ್ಹತೆ/ ವೃತ್ತಿ / Qualification/ Profession', value: row['Qualification'] || '', media: [] },
//         { label: 'ಪ್ರಸ್ತುತ ವಿಳಾಸ / Current Address', value: row['Current Address'] || '', media: [] },
//         { label: 'ಖಾಯಂ ವಿಳಾಸ / Permanent adress', value: row['Permanent Address'] || '', media: [] },
//         { label: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ /  Number', value: row['Mobile Number'] || row['Mobile Number '] || '', media: [] },
//         { label: 'ವಾರ್ಡ್‌ ಹೆಸರು, ಸಂಖ್ಯೆ . ಪಂಚಾಯಿತಿ ಹೆಸರು/ Ward Name, Number. Panchayat Name.', value: row['Ward Name'] || row['Ward Name '] || '', media: [] },
//         { label: 'ವಿಧಾನಸಭಾ ಕ್ಷೇತ್ರ / ಲೋಕಸಭಾ ಕ್ಷೇತ್ರ / Assembly Constituency / Lok Sabha Constituency', value: row['Assembly Constituency'] || '', media: [] },
//         { label: 'Blood Group', value: row['Blood Group'] || '', media: [] },
//         { label: 'Email ID', value: row['Email Id'] || '', media: [] },
//         { label: 'Adhar No', value: adharNo || '', media: [] },
//       ];

//       // Determine membership prefix
//       let membershipPrefix = 'M';
//       const amount = row['Amount'];
      
//       if (amount) {
//         const amountNum = parseFloat(amount);
//         if (amountNum >= 10000) membershipPrefix = 'P';
//         else if (amountNum >= 5000) membershipPrefix = 'S';
//         else if (amountNum >= 1000) membershipPrefix = 'B';
//         else membershipPrefix = 'G';
//       }

//       const submission = {
//         formId: formId,
//         district: district._id,
//         taluk: taluk._id,
//         adhar_no: adharNo || `TEMP_${Date.now()}_${index}`,
//         email: row['Email Id'] || undefined,
//         bloodGroup: row['Blood Group'] || undefined,
//         values: values,
//         paymentResult: { status: 'COMPLETED' },
//       };

//       // Generate membership ID
//       if (row['Membership ID']) {
//         submission.membershipId = `★${row['Membership ID']}`;
//       } else {
//         const counter = await MembershipCounter.findOneAndUpdate(
//           { prefix: membershipPrefix },
//           { $inc: { lastNumber: 1 } },
//           { upsert: true, new: true }
//         );
//         submission.membershipId = `★${membershipPrefix}-${String(counter.lastNumber).padStart(3, '0')}`;
//         console.log(`  Generated Membership ID: ${submission.membershipId}`);
//       }

//       if (row['Referred By']) {
//         submission.referredBy = row['Referred By'];
//       }

//       submissions.push(submission);
      
//     } catch (error) {
//       console.error(`❌ Error processing row ${index + 1}: ${error.message}`);
//       console.error(error.stack);
//       failCount++;
//     }
//   }

//   console.log(`\n${'='.repeat(70)}`);
//   console.log('📊 IMPORT SUMMARY');
//   console.log('='.repeat(70));
//   console.log(`Total rows: ${data.length}`);
//   console.log(`✓ Successfully processed: ${successCount}`);
//   console.log(`❌ Failed/Skipped: ${failCount}`);
//   console.log(`\n📸 Photo Statistics:`);
//   console.log(`  ✓ Photos saved: ${photoSuccessCount}`);
//   console.log(`  ❌ Photos failed/missing: ${photoFailCount}`);
//   console.log(`\nReady to import: ${submissions.length}`);
//   console.log('='.repeat(70));

//   if (submissions.length > 0) {
//     await MembershipSubmission.insertMany(submissions);
//     console.log(`\n✅✅ Successfully imported ${submissions.length} records to database!`);
//   } else {
//     console.log('\n⚠ No valid submissions to import');
//   }
// }

// // Main function
// (async () => {
//   await connectDB();
//   const filePath = './data2.xlsx';
  
//   try {
//     await importData(filePath);
//     console.log('\n✅ Import completed successfully!');
//   } catch (error) {
//     console.error('\n❌ Import failed:', error);
//     console.error(error.stack);
//   } finally {
//     mongoose.connection.close();
//   }
// })();


const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const District = require('./Modals/District');
const Taluk = require('./Modals/Taluk');
const Media = require('./Modals/Media');
const MediaType = require('./Modals/MediaType');
const { MembershipSubmission, MembershipForm, MembershipCounter } = require('./Modals/Membership');

const DB_URL = 'mongodb+srv://shamanth081:12345@cluster01.ardgsrg.mongodb.net/Membership';

// Add concurrency limit for image processing
const CONCURRENT_IMAGE_LIMIT = 5;

async function connectDB() {
  try {
    await mongoose.connect(DB_URL);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Extract images from Excel using ExcelJS - FIXED FOR FRACTIONAL ROWS
async function extractImagesFromExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet(1);
  const imagesByRow = {};
  
  console.log('\n=== Extracting Embedded Images ===');
  
  // Get all images from worksheet
  const images = worksheet.getImages();
  console.log(`Found ${images.length} total images in worksheet`);
  
  images.forEach((image, index) => {
    try {
      const imageId = image.imageId;
      const imageData = workbook.model.media.find(m => m.index === imageId);
      
      if (imageData && imageData.buffer) {
        // ExcelJS rows are 0-indexed and can be fractional for floating images
        // Round to nearest integer to match with data rows
        const floatRow = image.range.tl.row;
        const row = Math.round(floatRow);
        
        if (!imagesByRow[row]) {
          imagesByRow[row] = [];
        }
        
        imagesByRow[row].push({
          data: Buffer.from(imageData.buffer),
          extension: imageData.extension || 'png',
          name: imageData.name || `image_${row}_${index}`,
          col: image.range.tl.col,
          originalRow: floatRow // Keep original for debugging
        });
        
        console.log(`  [${index + 1}/${images.length}] Image at row ${floatRow.toFixed(2)} → rounded to row ${row} (Excel row ${row + 1})`);
      } else {
        console.warn(`  [${index + 1}/${images.length}] Warning: Image ${imageId} has no buffer data`);
      }
    } catch (error) {
      console.error(`  Error processing image ${index}: ${error.message}`);
    }
  });
  
  console.log(`✓ Extracted ${Object.keys(imagesByRow).length} unique rows with images`);
  console.log(`Total images: ${Object.values(imagesByRow).reduce((sum, imgs) => sum + imgs.length, 0)}`);
  console.log('Rounded row indices:', Object.keys(imagesByRow).sort((a, b) => Number(a) - Number(b)).join(', '));
  console.log('===================================\n');
  
  return imagesByRow;
}

// Read Excel data as JSON
async function readExcelData(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet(1);
  const data = [];
  
  const headers = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = cell.value?.toString().trim() || `Column${colNumber}`;
  });
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const rowData = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        let value = cell.value;
        
        if (value instanceof Date) {
          value = value.toLocaleDateString('en-GB');
        } else if (cell.type === ExcelJS.ValueType.Date) {
          value = cell.value.toLocaleDateString('en-GB');
        } else if (value && typeof value === 'object' && value.text) {
          value = value.text;
        }
        
        rowData[header] = value?.toString().trim() || '';
      }
    });
    
    rowData._excelRowNumber = rowNumber;
    data.push(rowData);
  });
  
  return data;
}

function normalizeString(value) {
  if (!value) return '';
  return value.toString().trim().normalize('NFC').replace(/\s+/g, ' ');
}

// Save extracted image buffer to temp file
async function saveImageBuffer(imageBuffer, imageExtension, rowNumber, index = 0) {
  const tempDir = './assets/temp_resources';
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const { v4: uuidv4 } = require('uuid');
  const timestamp = Date.now();
  const tempFileName = `${uuidv4()}-row${rowNumber}-${timestamp}-${index}.${imageExtension}`;
  const tempFilePath = path.join(tempDir, tempFileName);
  
  // Write buffer synchronously to avoid race conditions
  fs.writeFileSync(tempFilePath, imageBuffer);
  
  // Verify file was written
  if (!fs.existsSync(tempFilePath)) {
    throw new Error(`Failed to write temp file: ${tempFilePath}`);
  }
  
  const stats = fs.statSync(tempFilePath);
  console.log(`    Temp file created: ${tempFileName} (${stats.size} bytes)`);
  
  return {
    path: tempFilePath,
    filename: tempFileName,
    originalname: `row_${rowNumber}_image_${index}.${imageExtension}`,
    size: imageBuffer.length
  };
}

// Process image exactly like the media controller does
async function processSingleImage(image, rowNumber) {
  try {
    let original_file_name_without_extension = image.originalname.split('.');
    let original_file_extension = original_file_name_without_extension.pop();

    let current_file_name_without_extension = image.filename.split('.');
    let current_file_extension = current_file_name_without_extension.pop();

    let imageToReturn = {
      name: {
        original: original_file_name_without_extension[0],
        current: current_file_name_without_extension[0]
      },
      size: {
        original: image.size,
        current: 0
      },
      extension: {
        original: current_file_extension,
        current: ''
      },
      image_url: {
        full: {
          high_res: '',
          low_res: '',
        },
        thumbnail: {
          high_res: '',
          low_res: '',
        }
      }
    };

    // Verify file exists before processing
    if (!fs.existsSync(image.path)) {
      throw new Error(`Source image file not found: ${image.path}`);
    }

    const image_metadata = await sharp(image.path).metadata();

    let set_image_width_as_max_width = false;
    let is_thumbnail_required = false;

    if (image_metadata.width > 1500) {
      set_image_width_as_max_width = true;
    } else if (image_metadata.width > 500) {
      is_thumbnail_required = true;
    }

    const image_url = image.path.replace(/\\/g, "/");
    const url_array = image_url.split("/");
    const file_name_with_ext = url_array[url_array.length - 1];
    const file_name_without_ext = file_name_with_ext.replace(/\.[^/.]+$/, "");
    let final_file_name = file_name_without_ext.replaceAll(/\s/g, '');
    final_file_name = final_file_name.replace(/[{()}]/g, "");

    // Ensure directories exist
    const dirs = [
      'assets/images/full/high_res',
      'assets/images/full/low_res',
      'assets/images/thumb/high_res',
      'assets/images/thumb/low_res'
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Process full high res
    await sharp(image_url)
      .resize({ width: set_image_width_as_max_width ? 1500 : image_metadata.width })
      .toFormat('webp')
      .webp({ quality: 80 })
      .toFile(`assets/images/full/high_res/${final_file_name}.webp`);

    imageToReturn.image_url.full.high_res = `assets/images/full/high_res/${final_file_name}.webp`;

    // Process full low res
    await sharp(image_url)
      .resize({ width: set_image_width_as_max_width ? 1500 : image_metadata.width })
      .toFormat('webp')
      .webp({ quality: 60 })
      .toFile(`assets/images/full/low_res/${final_file_name}.webp`);

    imageToReturn.image_url.full.low_res = `assets/images/full/low_res/${final_file_name}.webp`;

    if (is_thumbnail_required) {
      await sharp(imageToReturn.image_url.full.high_res)
        .resize({ width: 250, height: 250, fit: 'contain', background: "#f1f5f9" })
        .toFormat('webp')
        .webp({ quality: 100 })
        .toFile(`assets/images/thumb/high_res/${final_file_name}.webp`);

      imageToReturn.image_url.thumbnail.high_res = `assets/images/thumb/high_res/${final_file_name}.webp`;

      await sharp(imageToReturn.image_url.full.low_res)
        .resize({ width: 250, height: 250, fit: 'contain', background: "#f1f5f9" })
        .toFormat('webp')
        .webp({ quality: 70 })
        .toFile(`assets/images/thumb/low_res/${final_file_name}.webp`);

      imageToReturn.image_url.thumbnail.low_res = `assets/images/thumb/low_res/${final_file_name}.webp`;
    } else {
      imageToReturn.image_url.thumbnail.high_res = imageToReturn.image_url.full.high_res;
      imageToReturn.image_url.thumbnail.low_res = imageToReturn.image_url.full.low_res;
    }

    let optimized_file_metadata = await sharp(imageToReturn.image_url.full.high_res).metadata();
    imageToReturn.extension.current = optimized_file_metadata.format;
    
    let optimized_image = fs.statSync(imageToReturn.image_url.full.high_res);
    imageToReturn.size.current = optimized_image.size;

    // Delete original temp file
    try {
      if (fs.existsSync(image.path)) {
        fs.unlinkSync(image.path);
        console.log(`    Cleaned up temp file: ${image.filename}`);
      }
    } catch (error) {
      console.warn(`    Warning: Could not delete temp file: ${error.message}`);
    }

    return {
      status: true,
      data: imageToReturn
    };
  } catch (error) {
    console.error(`    ❌ Error in processSingleImage for row ${rowNumber}: ${error.message}`);
    // Clean up temp file on error
    try {
      if (image.path && fs.existsSync(image.path)) {
        fs.unlinkSync(image.path);
      }
    } catch (cleanupError) {
      console.warn(`    Warning: Could not cleanup temp file: ${cleanupError.message}`);
    }
    return {
      status: false,
      error: error.message
    };
  }
}

// Create media entry in database
async function createMediaEntry(processedImage, imageMediaTypeId) {
  try {
    let new_media = {
      name: {
        temp: processedImage.data.name.current,
        original: processedImage.data.name.original,
        current: processedImage.data.name.current,
        history: []
      },
      extension: {
        original: processedImage.data.extension.original,
        current: processedImage.data.extension.current
      },
      size: {
        original: processedImage.data.size.original,
        current: processedImage.data.size.current
      },
      image_url: {
        full: {
          high_res: processedImage.data.image_url.full.high_res,
          low_res: processedImage.data.image_url.full.low_res,
        },
        thumbnail: {
          high_res: processedImage.data.image_url.thumbnail.high_res,
          low_res: processedImage.data.image_url.thumbnail.low_res,
        }
      },
      doc_url: undefined,
      video_url: {
        video: {
          high_res: undefined,
          low_res: undefined,
        },
        thumbnail: {
          high_res: undefined,
          low_res: undefined,
        }
      },
      other_file_url: undefined,
      media_type: imageMediaTypeId,
      uploaded_by: null,
    };

    let save_media = new Media(new_media);
    const savedMedia = await save_media.save();
    
    return savedMedia._id;
  } catch (error) {
    console.error(`    ❌ Error saving media to database: ${error.message}`);
    throw error;
  }
}

// Handle embedded image from Excel
async function handleEmbeddedImage(imageData, rowNumber, imageIndex = 0) {
  try {
    console.log(`    Processing image ${imageIndex + 1} for row ${rowNumber}...`);
    
    // Get or create image media type
    let imageMediaType = await MediaType.findOne({ name: 'image' });
    if (!imageMediaType) {
      console.log('    Creating image media type...');
      imageMediaType = await MediaType.create({ 
        name: 'image',
        is_archived: false 
      });
    }

    // Validate buffer
    if (!imageData.data || imageData.data.length === 0) {
      console.error(`    ❌ Invalid image buffer for row ${rowNumber}`);
      return null;
    }

    console.log(`    Image buffer size: ${imageData.data.length} bytes`);

    // Save buffer to temp file
    const tempFileInfo = await saveImageBuffer(
      imageData.data, 
      imageData.extension, 
      rowNumber,
      imageIndex
    );
    
    // Process the image
    const processedImage = await processSingleImage(tempFileInfo, rowNumber);

    if (!processedImage.status) {
      console.error(`    ❌ Failed to process image: ${processedImage.error}`);
      return null;
    }

    // Create media entry in database
    const mediaId = await createMediaEntry(processedImage, imageMediaType._id);
    
    console.log(`    ✓✓ Image successfully saved! Media ID: ${mediaId}`);

    return mediaId;

  } catch (error) {
    console.error(`    ❌ Error in handleEmbeddedImage for row ${rowNumber}: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}

async function importData(filePath, defaultFormId = null) {
  // Extract images first
  const imagesByRow = await extractImagesFromExcel(filePath);
  
  // Read data
  const data = await readExcelData(filePath);

  // Debug: Show first row
  if (data.length > 0) {
    console.log('\n=== First Row Column Names ===');
    Object.keys(data[0]).forEach(key => {
      if (!key.startsWith('_')) {
        console.log(`"${key}" = "${data[0][key]}"`);
      }
    });
    console.log('==============================\n');
  }

  // Get or create form
  let formId = defaultFormId;
  if (!formId) {
    console.log('\nNo formId provided. Looking for existing forms...');
    const existingForm = await MembershipForm.findOne().sort({ createdAt: -1 });
    
    if (existingForm) {
      formId = existingForm._id;
      console.log(`✓ Using existing form: ${formId}`);
    } else {
      console.log('No forms found. Creating default form...');
      const defaultForm = await MembershipForm.create({
        fields: [
          { inputType: 'text', label: 'Name', label_kn: 'ಹೆಸರು', required: true, order: 1 },
          { inputType: 'text', label: 'Gender', label_kn: 'ಲಿಂಗ', required: true, order: 2 },
          { inputType: 'text', label: 'Father/Mother/Husband Name', label_kn: 'ತಂದೆ/ತಾಯಿ/ಪತಿ ಹೆಸರು', required: true, order: 3 },
          { inputType: 'text', label: 'DOB', label_kn: 'ಹುಟ್ಟಿದ ದಿನಾಂಕ', required: true, order: 4 },
          { inputType: 'text', label: 'Caste', label_kn: 'ಜಾತಿ', required: false, order: 5 },
          { inputType: 'text', label: 'Subcaste', label_kn: 'ಉಪಜಾತಿ', required: false, order: 6 },
          { inputType: 'text', label: 'Qualification', label_kn: 'ಅರ್ಹತೆ', required: false, order: 7 },
          { inputType: 'textarea', label: 'Current Address', label_kn: 'ಪ್ರಸ್ತುತ ವಿಳಾಸ', required: true, order: 8 },
          { inputType: 'textarea', label: 'Permanent Address', label_kn: 'ಶಾಶ್ವತ ವಿಳಾಸ', required: false, order: 9 },
          { inputType: 'text', label: 'Mobile Number', label_kn: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ', required: true, order: 10 },
          { inputType: 'text', label: 'Ward Name', label_kn: 'ವಾರ್ಡ್ ಹೆಸರು', required: false, order: 11 },
          { inputType: 'text', label: 'Assembly Constituency', label_kn: 'ವಿಧಾನಸಭಾ ಕ್ಷೇತ್ರ', required: false, order: 12 },
          { inputType: 'number', label: 'Amount', label_kn: 'ಮೊತ್ತ', required: false, order: 13 },
          { inputType: 'media', label: 'Photos', label_kn: 'ಫೋಟೋಗಳು', required: false, order: 14 },
        ],
      });
      formId = defaultForm._id;
      console.log(`✓ Created default form: ${formId}`);
    }
  }

  console.log(`\n📋 Using Form ID: ${formId}\n`);

  let successCount = 0;
  let failCount = 0;
  let photoSuccessCount = 0;
  let photoFailCount = 0;

  // Process rows SEQUENTIALLY to avoid overwhelming the system
  const submissions = [];
  
  for (let index = 0; index < data.length; index++) {
    const row = data[index];
    
    try {
      const districtName = normalizeString(row['District']);
      const talukName = normalizeString(row['Taluk']);
      const adharNo = normalizeString(row['Aadhar No.'] || row['Adhar No']);

      if (!districtName || !talukName) {
        console.error(`❌ Row ${index + 1}: Skipping - missing District or Taluk`);
        failCount++;
        continue;
      }

      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📄 Row ${index + 1}/${data.length} (Excel Row ${row._excelRowNumber})`);
      console.log(`${'─'.repeat(60)}`);

      const district = await District.findOne({ 
        name: { $regex: new RegExp(`^${districtName}$`, 'i') } 
      });
      
      if (!district) {
        console.error(`❌ District not found: "${districtName}"`);
        failCount++;
        continue;
      }

      const taluk = await Taluk.findOne({ 
        name: { $regex: new RegExp(`^${talukName}$`, 'i') },
        district: district._id 
      });
      
      if (!taluk) {
        console.error(`❌ Taluk not found: "${talukName}"`);
        failCount++;
        continue;
      }

      console.log(`✓ District: "${district.name}", Taluk: "${taluk.name}"`);

      // Handle embedded image for this row
      // FIXED: Use rounded row indices to match fractional image positions
      let photoMediaId = null;
      // row._excelRowNumber is 1-indexed (e.g., 2, 3, 4...)
      // imagesByRow now uses rounded 0-indexed values (e.g., 1, 2, 3...)
      // So we subtract 1 from _excelRowNumber to get the 0-indexed row
      const imageRowIndex = row._excelRowNumber - 1;
      
      console.log(`\n📸 Looking for image at index ${imageRowIndex} (Excel row ${row._excelRowNumber})...`);
      
      if (imagesByRow[imageRowIndex] && imagesByRow[imageRowIndex].length > 0) {
        console.log(`  ✓ Found ${imagesByRow[imageRowIndex].length} image(s)!`);
        
        // Process all images for this row
        const mediaIds = [];
        for (let imgIdx = 0; imgIdx < imagesByRow[imageRowIndex].length; imgIdx++) {
          const imageData = imagesByRow[imageRowIndex][imgIdx];
          console.log(`  Original image position: ${imageData.originalRow.toFixed(2)} → rounded to ${imageRowIndex}`);
          
          const mediaId = await handleEmbeddedImage(imageData, row._excelRowNumber, imgIdx);
          
          if (mediaId) {
            mediaIds.push(mediaId);
            photoSuccessCount++;
            console.log(`  ✓✓ Photo ${imgIdx + 1} saved successfully for Excel row ${row._excelRowNumber}`);
          } else {
            photoFailCount++;
            console.log(`  ❌ Photo ${imgIdx + 1} failed to save for Excel row ${row._excelRowNumber}`);
          }
        }
        
        // Use first media ID for the photo field
        photoMediaId = mediaIds.length > 0 ? mediaIds[0] : null;
      } else {
        console.log(`  ⚠ No image found at index ${imageRowIndex}`);
        photoFailCount++;
      }

      successCount++;

      // Build values array
      const values = [
        { label: 'Membership Amount', value: row['Amount'] || '', media: [] },
        { 
          label: 'ಛಾಯಾಚಿತ್ರ /Upload photo', 
          value: photoMediaId ? [photoMediaId.toString()] : [],
          media: photoMediaId ? [photoMediaId] : []
        },
        { label: 'ಅರ್ಜಿದಾರನ/ಳ ಹೆಸರು/ Applicant Name', value: row['Name'] || row['Name '] || '', media: [] },
        { label: 'ಲಿಂಗ/Gender', value: row['Gender'] || '', media: [] },
        { label: 'ತಂದೆ/ತಾಯಿ/ಗಂಡನ ಹೆಸರು / Father/Mother/Husband/Name', value: row['Father/Mother/Husband Name'] || '', media: [] },
        { label: 'ಜನ್ಮ ದಿನಾಂಕ/Date of Birth', value: row['DOB'] || '', media: [] },
        { label: 'ಜಾತಿ/Caste', value: row['Caste'] || '', media: [] },
        { label: 'ಉಪಜಾತಿ /Subcaste', value: row['Subcaste'] || '', media: [] },
        { label: 'ವಿದ್ಯಾರ್ಹತೆ/ ವೃತ್ತಿ / Qualification/ Profession', value: row['Qualification'] || '', media: [] },
        { label: 'ಪ್ರಸ್ತುತ ವಿಳಾಸ / Current Address', value: row['Current Address'] || '', media: [] },
        { label: 'ಖಾಯಂ ವಿಳಾಸ / Permanent adress', value: row['Permanent Address'] || '', media: [] },
        { label: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ /  Number', value: row['Mobile Number'] || row['Mobile Number '] || '', media: [] },
        { label: 'ವಾರ್ಡ್‌ ಹೆಸರು, ಸಂಖ್ಯೆ . ಪಂಚಾಯಿತಿ ಹೆಸರು/ Ward Name, Number. Panchayat Name.', value: row['Ward Name'] || row['Ward Name '] || '', media: [] },
        { label: 'ವಿಧಾನಸಭಾ ಕ್ಷೇತ್ರ / ಲೋಕಸಭಾ ಕ್ಷೇತ್ರ / Assembly Constituency / Lok Sabha Constituency', value: row['Assembly Constituency'] || '', media: [] },
        { label: 'Blood Group', value: row['Blood Group'] || '', media: [] },
        { label: 'Email ID', value: row['Email Id'] || '', media: [] },
        { label: 'Adhar No', value: adharNo || '', media: [] },
      ];

      // Determine membership prefix
      let membershipPrefix = 'M';
      const amount = row['Amount'];
      
      if (amount) {
        const amountNum = parseFloat(amount);
        if (amountNum >= 10000) membershipPrefix = 'P';
        else if (amountNum >= 5000) membershipPrefix = 'S';
        else if (amountNum >= 1000) membershipPrefix = 'B';
        else membershipPrefix = 'G';
      }

      const submission = {
        formId: formId,
        district: district._id,
        taluk: taluk._id,
        adhar_no: adharNo || `TEMP_${Date.now()}_${index}`,
        email: row['Email Id'] || undefined,
        bloodGroup: row['Blood Group'] || undefined,
        values: values,
        paymentResult: { status: 'COMPLETED' },
      };

      // Generate membership ID
      if (row['Membership ID']) {
        submission.membershipId = `★${row['Membership ID']}`;
      } else {
        const counter = await MembershipCounter.findOneAndUpdate(
          { prefix: membershipPrefix },
          { $inc: { lastNumber: 1 } },
          { upsert: true, new: true }
        );
        submission.membershipId = `★${membershipPrefix}-${String(counter.lastNumber).padStart(3, '0')}`;
        console.log(`  Generated Membership ID: ${submission.membershipId}`);
      }

      if (row['Referred By']) {
        submission.referredBy = row['Referred By'];
      }

      submissions.push(submission);
      
    } catch (error) {
      console.error(`❌ Error processing row ${index + 1}: ${error.message}`);
      console.error(error.stack);
      failCount++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total rows: ${data.length}`);
  console.log(`✓ Successfully processed: ${successCount}`);
  console.log(`❌ Failed/Skipped: ${failCount}`);
  console.log(`\n📸 Photo Statistics:`);
  console.log(`  ✓ Photos saved: ${photoSuccessCount}`);
  console.log(`  ❌ Photos failed/missing: ${photoFailCount}`);
  console.log(`\nReady to import: ${submissions.length}`);
  console.log('='.repeat(70));

  if (submissions.length > 0) {
    await MembershipSubmission.insertMany(submissions);
    console.log(`\n✅✅ Successfully imported ${submissions.length} records to database!`);
  } else {
    console.log('\n⚠ No valid submissions to import');
  }
}

// Main function
(async () => {
  await connectDB();
  const filePath = './data2.xlsx';
  
  try {
    await importData(filePath);
    console.log('\n✅ Import completed successfully!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    console.error(error.stack);
  } finally {
    mongoose.connection.close();
  }
})();
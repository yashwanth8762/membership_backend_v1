const https = require('https');
const axios = require('axios');
const Media = require('../../Modals/Media');
const District = require('../../Modals/District');
const Taluk = require('../../Modals/Taluk');
const querystring = require('querystring');

// const MembershipCounter = require('../../Modals/Membership'); // You must create this schema/model
const mongoose = require('mongoose');
const { MembershipForm, MembershipSubmission,MembershipCounter } = require('../../Modals/Membership');
const {StandardCheckoutClient, Env, StandardCheckoutPayRequest} = require('pg-sdk-node')
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const clientVersion = 1
const env = Env.PRODUCTION
const client = StandardCheckoutClient.getInstance(clientId,clientSecret,clientVersion,env)


// Map membership amount to prefix letters for ID generation
const membershipPrefixMap = {
  500: 'G',       // General
  5000: 'S',      // Special
  10000: 'P',     // Premium
  25000: 'L',     // Lifetime
  50000: 'PT',     // Patron
  100000: 'CPT',    // Chief Patron
};

// Helper: atomic sequential membership ID generator
async function getNextMembershipId(membershipAmount) {
  const prefix = membershipPrefixMap[membershipAmount] || 'G';

  const updatedCounter = await MembershipCounter.findOneAndUpdate(
    { prefix },
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );

  const numberStr = updatedCounter.lastNumber.toString().padStart(3, '0');
  return `${prefix}-${numberStr}`;
}


// Admin: Create a new membership form structure
exports.createForm = async (req, res) => {
  try {
    let { fields } = req.body;
    fields = fields.map(f => ({
      ...f,
      label: f.label,
      label_kn: f.label_kn || '',
    }));
    const form = new MembershipForm({ fields });
    await form.save();
    res.status(201).json(form);
  } catch (error) {
    res.status(500).json({ message: 'Error creating form', error: error.message });
  }
};


// Admin: Get all membership forms
exports.getForms = async (req, res) => {
  try {
    const forms = await MembershipForm.find();
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching forms', error: error.message });
  }
};


// User: Submit a membership form with sequential membership ID generation
exports.submitMembership = async (req, res) => {
  try {
    const { formId, district, taluk, adhar_no, email, bloodGroup, values, paymentResult } = req.body;

    // Validate required fields
    if (!formId) return res.status(400).json({ message: "Form ID is required" });
    if (!district) return res.status(400).json({ message: "District is required" });
    if (!taluk) return res.status(400).json({ message: "Taluk is required" });
    if (!adhar_no) return res.status(400).json({ message: "Adhar number is required" });
    if (!Array.isArray(values)) return res.status(400).json({ message: "Values array is required" });

    // Check duplicate Aadhaar
    const existingAdhar = await MembershipSubmission.findOne({ adhar_no });
    if (existingAdhar) {
      return res.status(400).json({ message: "A membership with this Adhar number already exists." });
    }

    // Extract membership amount or default 500
    const membershipAmountEntry = values.find(v => v.label === "Membership Amount");
    const membershipAmount = membershipAmountEntry ? parseInt(membershipAmountEntry.value) : 500;

    // Generate membershipId if needed
    const membershipId = await getNextMembershipId(membershipAmount);

    // Process values array for media
    const processedValues = values.map(item => ({
      label: item.label,
      value: item.value,
      media: Array.isArray(item.value) && item.value.length && item.value[0] !== null
        ? item.value.filter(id => id !== null)
        : (item.media || [])
    }));
    
    // Create and save membership submission
    const submission = new MembershipSubmission({
      membershipId,
      formId,
      district,
      taluk,
      adhar_no,
      email,
      bloodGroup,
      paymentResult: {
        status: 'initiated'
      },
      values: processedValues,
      submittedAt: new Date(),
    });
    await submission.save();

    // Use saved _id as merchantOrderId
    const merchantOrderId = submission._id.toString();
    console.log('merchantOrderId passed:', merchantOrderId);

    // Setup redirect URL with merchantOrderId
    const redirectUrl = `https://www.madaramahasabha.com/api/membership/check-status?merchantOrderId=${merchantOrderId}`;
    // const redirectUrl = `http://localhost:5000/membership/check-status?merchantOrderId=${merchantOrderId}`;

    // Use your production URL as needed:
    // const redirectUrl = `https://www.madaramahasabha.com/api/membership/check-status?merchantOrderId=${merchantOrderId}`;

    // Convert rupees to paise (multiply by 100)
    const amountInPaise = Math.round(membershipAmount * 100);

    const request = StandardCheckoutPayRequest.builder(merchantOrderId)
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(redirectUrl)
      .build();

    const paymentResponse = await client.pay(request);

    return res.status(201).json({
      membershipId,
      submission,
      checkoutPageUrl: paymentResponse.redirectUrl
    });
  } catch (error) {
    console.error("Error in submitMembership:", error);
    res.status(500).json({ message: "Error submitting membership", error: error.message });
  }
};



// User: Get a membership submission by membershipId or _id
exports.getMembershipById = async (req, res) => {
  try {
    const { membershipId } = req.params;

    // Only attempt findById if the param is a valid ObjectId (merchantOrderId case)
    let submission = null;
    if (mongoose.Types.ObjectId.isValid(membershipId)) {
      submission = await MembershipSubmission.findById(membershipId)
        .populate('district', 'name k_name')
        .populate('taluk', 'name k_name');
    }

    // Fallback: look up by string membershipId like "G-020"
    if (!submission) {
      submission = await MembershipSubmission.findOne({ membershipId })
        .populate('district', 'name k_name')
        .populate('taluk', 'name k_name');
    }

    if (!submission) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    // Populate media details inside values
    const populatedValues = await Promise.all(
      submission.values.map(async (value) => {
        if (value.media && value.media.length > 0) {
          const mediaDetails = await Promise.all(
            value.media.map(async (mediaId) => {
              const media = await Media.findById(mediaId);
              if (media) {
                return {
                  id: media._id,
                  name: media.name,
                  image_url: media.image_url,
                  doc_url: media.doc_url,
                  video_url: media.video_url,
                  extension: media.extension,
                  size: media.size,
                };
              }
              return null;
            })
          );
          return {
            ...value,
            media: mediaDetails.filter(m => m !== null),
          };
        }
        return value;
      })
    );

    const response = {
      ...submission.toObject(),
      values: populatedValues,
      district: submission.district,
      taluk: submission.taluk,
    };

    res.json(response);
  } catch (error) {
    console.error('Error in getMembershipById:', error);
    res.status(500).json({ message: 'Error fetching membership', error: error.message });
  }
};


// User: Get memberships filtered by district/taluk
exports.getMembershipsFiltered = async (req, res) => {
  try {
    let { district, taluk } = req.query;
    const query = {};

    if (district && district !== "30") {
      if (mongoose.Types.ObjectId.isValid(district)) {
        query.district = new mongoose.Types.ObjectId(district);
      } else {
        return res.json([]);
      }
    }

    if (taluk && taluk !== "30") {
      if (mongoose.Types.ObjectId.isValid(taluk)) {
        query.taluk = new mongoose.Types.ObjectId(taluk);
      } else {
        return res.json([]);
      }
    }

    const submissions = await MembershipSubmission.find(query)
      .populate("district", "name k_name")
      .populate("taluk", "name k_name")
      .lean();

    // Deeply populate media for each value
    const response = await Promise.all(
      submissions.map(async (submission) => {
        const populatedValues = await Promise.all(
          (submission.values || []).map(async (val) => {
            if (val.media && val.media.length > 0) {
              const mediaDocs = await Media.find({ _id: { $in: val.media } }).lean();
              return { ...val, media: mediaDocs };
            }
            return val;
          })
        );
        return { ...submission, values: populatedValues };
      })
    );

    res.json(response);
  } catch (error) {
    console.error("Error fetching filtered membership submissions:", error);
    res.status(500).json({ message: "Error fetching submissions", error: error.message });
  }
};



// exports.getStatusOfPayment = async (req, res) => {
//   console.log('getStatusOfPayment invoked with query:', req.query);

//   try {
//     const { merchantOrderId } = req.query;
//     if (!merchantOrderId) {
//       return res.status(400).send("MerchantOrderId is required");
//     }
//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     // Update paymentResult.status before redirecting
//     if (status === 'COMPLETED') {
//       const updated = await MembershipSubmission.findOneAndUpdate(
//         { _id: merchantOrderId },
//         { 
//           'paymentResult.status': 'COMPLETED',
//           'paymentResult.paymentDate': new Date(),
//           'paymentResult.phonepeResponse': response
//         },
//         { new: true }
//       );

//       // Send WhatsApp via MSG91 (best-effort)
//       try {
//         const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
//         const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || '15558848753';
//         const MSG91_NAMESPACE = process.env.MSG91_NAMESPACE || '33b99d31_01ca_42e2_83fc_59571bba67f6';
//         const TEMPLATE_NAME = process.env.MSG91_TEMPLATE_NAME || 'madara';

//         let mobileNumber = '';
//         if (updated && Array.isArray(updated.values)) {
//           const mobileField = updated.values.find(v =>
//             (v.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v.label))) ||
//             (v._doc && v._doc.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v._doc.label)))
//           );
//           if (mobileField) mobileNumber = (mobileField.value || mobileField._doc?.value || '').toString().trim();
//         }

//         // Normalize number with country code prefix
//         if (mobileNumber) {
//           const digits = mobileNumber.replace(/\D/g, '');
//           if (digits.length === 10) {
//             mobileNumber = `91${digits}`;
//           } else if (digits.startsWith('91') && digits.length === 12) {
//             mobileNumber = digits;
//           } else {
//             mobileNumber = digits;
//           }
//         }

//         console.log('mobileNumber_normalized', mobileNumber, 'namespace', MSG91_NAMESPACE, 'integrated', MSG91_INTEGRATED_NUMBER);

//         if (mobileNumber && MSG91_AUTHKEY) {
//           const payload = {
//             integrated_number: MSG91_INTEGRATED_NUMBER,
//             content_type: 'template',
//             payload: {
//               messaging_product: 'whatsapp',
//               to: mobileNumber,
//               type: 'template',
//               template: {
//                 name: TEMPLATE_NAME,
//                 language: { code: 'en', policy: 'deterministic' },
//                 namespace: MSG91_NAMESPACE,
//                 components: [
//                   {
//                     type: 'body',
//                     parameters: [
//                       { type: 'text', text: 'value1' }
//                     ]
//                   }
//                 ]
//               }
//             }
//           };

//           const apiResponse = await axios.post(
//             'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/',
//             payload,
//             { headers: { 'Content-Type': 'application/json', authkey: MSG91_AUTHKEY } }
//           );

//           console.log('MSG91 WhatsApp API response:', apiResponse.data);
//         }
//       } catch (waErr) {
//         console.log('MSG91 WhatsApp send failed:', waErr?.response?.data || waErr.message);
//       }

//       return res.redirect(`http://localhost:5173/payment-success?merchantOrderId=${merchantOrderId}`);
//       // return res.redirect(`https://www.madaramahasabha.com/payment-success?merchantOrderId=${merchantOrderId}`);
//     } else {
//       await MembershipSubmission.findOneAndUpdate(
//         { _id: merchantOrderId },
//         { 
//           'paymentResult.status': 'FAILED',
//           'paymentResult.phonepeResponse': response
//         }
//       );
//       return res.redirect(`http://localhost:5173/payment-failure?merchantOrderId=${merchantOrderId}`);
//       // return res.redirect(`https://www.madaramahasabha.com/payment-failure?merchantOrderId=${merchantOrderId}`);
//     }

//   } catch (error) {
//     console.log('error while Payment', error);
//     res.status(500).send('Internal server error during payment status check');
//   }
// };



// async function sendSmsViaMsg91(mobileNumber, message) {
//   const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1'; // Your MSG91 authkey
//   const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'ISHAMS'; // DLT-approved sender ID
//   const MSG91_ROUTE = '4'; // Transactional route for SMS
// console.log('inside the sms');

//   try {
//     const params = new URLSearchParams({
//       authkey: MSG91_AUTHKEY,
//       mobiles: mobileNumber,
//       message: message,
//       sender: MSG91_SENDER_ID,
//       route: MSG91_ROUTE,
//       country: '91',
//     });

//     const response = await axios.get(`https://api.msg91.com/api/sendhttp.php?${params.toString()}`);

//     console.log('MSG91 SMS API response:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error('Error sending SMS via MSG91:', error.response?.data || error.message);
//     throw error;
//   }
// }

// function personalizeSms(template, membershipId) {
//   return template.replace('##var##', membershipId);
// }

// exports.getStatusOfPayment = async (req, res) => {
//   console.log('getStatusOfPayment invoked with query:', req.query);

//   try {
//     const { merchantOrderId } = req.query;
//     if (!merchantOrderId) {
//       return res.status(400).send("MerchantOrderId is required");
//     }
//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     if (status === 'COMPLETED') {
//       const updated = await MembershipSubmission.findOneAndUpdate(
//         { _id: merchantOrderId },
//         { 
//           'paymentResult.status': 'COMPLETED',
//           'paymentResult.paymentDate': new Date(),
//           'paymentResult.phonepeResponse': response
//         },
//         { new: true }
//       );

//       // Extract mobile number
//       let mobileNumber = '';
//       if (updated && Array.isArray(updated.values)) {
//         const mobileField = updated.values.find(v =>
//           (v.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v.label))) ||
//           (v._doc && v._doc.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v._doc.label)))
//         );
//         if (mobileField) mobileNumber = (mobileField.value || mobileField._doc?.value || '').toString().trim();
//       }

//       // Normalize mobile number with country code
//       if (mobileNumber) {
//         const digits = mobileNumber.replace(/\D/g, '');
//         if (digits.length === 10) {
//           mobileNumber = `91${digits}`;
//         } else if (digits.startsWith('91') && digits.length === 12) {
//           mobileNumber = digits;
//         } else {
//           mobileNumber = digits;
//         }
//       }

//       console.log('mobileNumber_normalized', mobileNumber);

//       // Send WhatsApp message via MSG91
//       try {
//         const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
//         const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || '15558848753';
//         const MSG91_NAMESPACE = process.env.MSG91_NAMESPACE || '33b99d31_01ca_42e2_83fc_59571bba67f6';
//         const TEMPLATE_NAME = process.env.MSG91_TEMPLATE_NAME || 'madara';

//         if (mobileNumber && MSG91_AUTHKEY) {
//           const payload = {
//             integrated_number: MSG91_INTEGRATED_NUMBER,
//             content_type: 'template',
//             payload: {
//               messaging_product: 'whatsapp',
//               to: mobileNumber,
//               type: 'template',
//               template: {
//                 name: TEMPLATE_NAME,
//                 language: { code: 'en', policy: 'deterministic' },
//                 namespace: MSG91_NAMESPACE,
//                 components: [
//                   {
//                     type: 'body',
//                     parameters: [
//                       { type: 'text', text: 'value1' }
//                     ]
//                   }
//                 ]
//               }
//             }
//           };

//           const apiResponse = await axios.post(
//             'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/',
//             payload,
//             { headers: { 'Content-Type': 'application/json', authkey: MSG91_AUTHKEY } }
//           );

//           console.log('MSG91 WhatsApp API response:', apiResponse.data);
//         }
//       } catch (waErr) {
//         console.log('MSG91 WhatsApp send failed:', waErr?.response?.data || waErr.message);
//       }

//       // Prepare SMS content and send SMS
//       const smsTemplate = `
// Application Accepted
// We have accepted your application request for General Membership under Karnataka Madara Mahasabha and received Membership Fee.
// You are now successfully registered under General Membership.
// Membership ID: ##var##
// Welcome to the Mahasabha family!
//       `;

//       const smsMessage = personalizeSms(smsTemplate, updated.membershipId);

//       try {
//         if (mobileNumber) {
//           await sendSmsViaMsg91(mobileNumber, smsMessage);
//         }
//       } catch (smsErr) {
//         console.log('MSG91 SMS send failed:', smsErr?.response?.data || smsErr.message);
//       }

//       return res.redirect(`http://localhost:5174/payment-success?merchantOrderId=${merchantOrderId}`);
//       // return res.redirect(`https://www.madaramahasabha.com/payment-success?merchantOrderId=${merchantOrderId}`);
//     } else {
//       await MembershipSubmission.findOneAndUpdate(
//         { _id: merchantOrderId },
//         { 
//           'paymentResult.status': 'FAILED',
//           'paymentResult.phonepeResponse': response
//         }
//       );
//       return res.redirect(`http://localhost:5174/payment-failure?merchantOrderId=${merchantOrderId}`);
//       // return res.redirect(`https://www.madaramahasabha.com/payment-failure?merchantOrderId=${merchantOrderId}`);
//     }

//   } catch (error) {
//     console.log('error while Payment', error);
//     res.status(500).send('Internal server error during payment status check');
//   }
// };

// const axios = require('axios');

// async function sendSmsViaMsg91(mobileNumber, membershipId) {
//   const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
//   const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || 'YourMsg91TemplateID';

//   try {
//     const payload = {
//       template_id: MSG91_TEMPLATE_ID,
//       short_url: "0",
//       realTimeResponse: "1",
//       smsroute: "4",  // Required to avoid "Route Missing" error
//       recipients: [
//         {
//           mobiles: mobileNumber,
//           VAR1: membershipId,
//         }
//       ],
//     };

//     const response = await axios.post(
//       'https://control.msg91.com/api/v5/flow',
//       payload,
//       { headers: { 'Content-Type': 'application/json', authkey: MSG91_AUTHKEY } }
//     );

//     console.log('MSG91 SMS Template API response:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error('Error sending SMS via MSG91 Template API:', error.response?.data || error.message);
//     throw error;
//   }
// }


// async function sendSmsViaMsg91(mobileNumber, membershipId) {
//   const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
//   const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || 'YourMsg91TemplateID';
//   console.log('membershipId', membershipId);

//   try {
//     const payload = {
//       template_id: MSG91_TEMPLATE_ID,
//       short_url: "0",
//       realTimeResponse: "1",
//       smsroute: "4",
//       recipients: [
//         {
//           mobiles: mobileNumber,
//           VAR1: membershipId,  
//         }
//       ],
//     };

//     const response = await axios.post(
//       'https://control.msg91.com/api/v5/flow',
//       payload,
//       { headers: { 'Content-Type': 'application/json', authkey: MSG91_AUTHKEY } }
//     );

//     console.log('MSG91 SMS Template API response:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error('Error sending SMS via MSG91 Template API:', error.response?.data || error.message);
//     throw error;
//   }
// }



// exports.getStatusOfPayment = async (req, res) => {
//   console.log('getStatusOfPayment invoked with query:', req.query);

//   try {
//     const { merchantOrderId } = req.query;
//     if (!merchantOrderId) {
//       return res.status(400).send("MerchantOrderId is required");
//     }
//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     if (status === 'COMPLETED') {
//       const updated = await MembershipSubmission.findOneAndUpdate(
//         { _id: merchantOrderId },
//         { 
//           'paymentResult.status': 'COMPLETED',
//           'paymentResult.paymentDate': new Date(),
//           'paymentResult.phonepeResponse': response
//         },
//         { new: true }
//       );

//       // Extract mobile number
//       let mobileNumber = '';
//       if (updated && Array.isArray(updated.values)) {
//         const mobileField = updated.values.find(v =>
//           (v.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v.label))) ||
//           (v._doc && v._doc.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v._doc.label)))
//         );
//         if (mobileField) mobileNumber = (mobileField.value || mobileField._doc?.value || '').toString().trim();
//       }

//       // Normalize mobile number with country code
//       if (mobileNumber) {
//         const digits = mobileNumber.replace(/\D/g, '');
//         if (digits.length === 10) {
//           mobileNumber = `91${digits}`;
//         } else if (digits.startsWith('91') && digits.length === 12) {
//           mobileNumber = digits;
//         } else {
//           mobileNumber = digits;
//         }
//       }

//       console.log('mobileNumber_normalized', mobileNumber);

//       // Send WhatsApp message via MSG91
//       try {
//         const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
//         const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || '15558848753';
//         const MSG91_NAMESPACE = process.env.MSG91_NAMESPACE || '33b99d31_01ca_42e2_83fc_59571bba67f6';
//         const TEMPLATE_NAME = process.env.MSG91_TEMPLATE_NAME || 'madara';

//         if (mobileNumber && MSG91_AUTHKEY) {
//           const payload = {
//             integrated_number: MSG91_INTEGRATED_NUMBER,
//             content_type: 'template',
//             payload: {
//               messaging_product: 'whatsapp',
//               to: mobileNumber,
//               type: 'template',
//               template: {
//                 name: TEMPLATE_NAME,
//                 language: { code: 'en', policy: 'deterministic' },
//                 namespace: MSG91_NAMESPACE,
//                 components: [
//                   {
//                     type: 'body',
//                     parameters: [
//                       { type: 'text', text: 'value1' }
//                     ]
//                   }
//                 ]
//               }
//             }
//           };

//           const apiResponse = await axios.post(
//             'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
//             payload,
//             { headers: { 'Content-Type': 'application/json', authkey: MSG91_AUTHKEY } }
//           );

//           console.log('MSG91 WhatsApp API response:', apiResponse.data);
//         }
//       } catch (waErr) {
//         console.log('MSG91 WhatsApp send failed:', waErr?.response?.data || waErr.message);
//       }

//       // Send SMS template message via MSG91 new API
//       try {
//         if (mobileNumber && updated.membershipId) {
//           await sendSmsViaMsg91(mobileNumber, updated.membershipId);
//         }
//       } catch (smsErr) {
//         console.log('MSG91 SMS Template send failed:', smsErr?.response?.data || smsErr.message);
//       }

//       return res.redirect(`http://localhost:5174/payment-success?merchantOrderId=${merchantOrderId}`);
//       // return res.redirect(`https://www.madaramahasabha.com/payment-success?merchantOrderId=${merchantOrderId}`);
//     } else {
//       await MembershipSubmission.findOneAndUpdate(
//         { _id: merchantOrderId },
//         { 
//           'paymentResult.status': 'FAILED',
//           'paymentResult.phonepeResponse': response
//         }
//       );
//       return res.redirect(`http://localhost:5174/payment-failure?merchantOrderId=${merchantOrderId}`);
//       // return res.redirect(`https://www.madaramahasabha.com/payment-failure?merchantOrderId=${merchantOrderId}`);
//     }
//   } catch (error) {
//     console.log('error while Payment', error);
//     res.status(500).send('Internal server error during payment status check');
//   }
// };


// async function sendSmsViaMsg91(mobileNumber, membershipId) {
//   const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
//   const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || 'YourMsg91TemplateID';

//   try {
//     const payload = {
//       template_id: MSG91_TEMPLATE_ID,
//       short_url: "0",
//       realTimeResponse: "1",
//       smsroute: "4",
//       recipients: [
//         {
//           mobiles: mobileNumber,
//           MembershipID: membershipId,
//         }
//       ],
//     };

//     const response = await axios.post(
//       'https://control.msg91.com/api/v5/flow',
//       payload,
//       { headers: { 'Content-Type': 'application/json', authkey: MSG91_AUTHKEY } }
//     );

//     console.log('MSG91 SMS Template API response:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error('Error sending SMS via MSG91 Template API:', error.response?.data || error.message);
//     throw error;
//   }
// }


async function sendSmsViaMsg91(mobileNumber, membershipId) {
  const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
  const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || 'YourMsg91TemplateID';
  const payload = {
    template_id: MSG91_TEMPLATE_ID,
    short_url: "0",
    realTimeResponse: "1",
    smsroute: "4",
    recipients: [
      {
        mobiles: mobileNumber,
        var: membershipId, // Use exact variable name from DLT template
      }
    ],
  };

  try {
    const response = await axios.post(
      'https://control.msg91.com/api/v5/flow',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          authkey: MSG91_AUTHKEY,
        },
      }
    );
    console.log('MSG91 SMS Template API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending SMS via MSG91 Template API:', error.response?.data || error.message);
    throw error;
  }
}

// exports.getStatusOfPayment = async (req, res) => {
//   console.log('getStatusOfPayment invoked with query:', req.query);

//   try {
//     const { merchantOrderId } = req.query;
//     if (!merchantOrderId) {
//       return res.status(400).send("MerchantOrderId is required");
//     }

//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     if (status === 'COMPLETED') {
//       const updated = await MembershipSubmission.findOneAndUpdate(
//         { _id: merchantOrderId },
//         {
//           'paymentResult.status': 'COMPLETED',
//           'paymentResult.paymentDate': new Date(),
//           'paymentResult.phonepeResponse': response
//         },
//         { new: true }
//       );

//       // Extract mobile number
//       let mobileNumber = '';
//       if (updated && Array.isArray(updated.values)) {
//         const mobileField = updated.values.find(v =>
//           (v.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v.label))) ||
//           (v._doc && v._doc.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v._doc.label)))
//         );
//         if (mobileField) mobileNumber = (mobileField.value || mobileField._doc?.value || '').toString().trim();
//       }

//       // Normalize mobile number with country code
//       if (mobileNumber) {
//         const digits = mobileNumber.replace(/\D/g, '');
//         if (digits.length === 10) {
//           mobileNumber = `91${digits}`;
//         } else if (digits.startsWith('91') && digits.length === 12) {
//           mobileNumber = digits;
//         } else {
//           mobileNumber = digits;
//         }
//       }

//       console.log('mobileNumber_normalized', mobileNumber);

//       // Send WhatsApp message via MSG91 text API with query parameters
//       if (mobileNumber) {
//         const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
//         const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || '15558848753';

//         const membershipId = updated.membershipId || '';

//         // Construct the WhatsApp message with dynamic membership ID
//         const messageText = `Application Accepted
// We have accepted your application request for General Membership under Karnataka Madara Mahasabha and received Membership Fee.
// You are now successfully registered under General Membership.
// Membership ID: ${membershipId}
// Welcome to the Mahasabha family!`;

//         const queryParams = querystring.stringify({
//           integrated_number: MSG91_INTEGRATED_NUMBER,
//           recipient_number: mobileNumber,
//           content_type: 'text',
//           text: messageText
//         });

//         const options = {
//           method: 'POST',
//           hostname: 'control.msg91.com',
//           path: `/api/v5/whatsapp/whatsapp-outbound-message/?${queryParams}`,
//           headers: {
//             accept: 'application/json',
//             authkey: MSG91_AUTHKEY,
//             'content-type': 'application/json',
//           }
//         };

//         const req = https.request(options, (res) => {
//           const chunks = [];
//           res.on('data', (chunk) => chunks.push(chunk));
//           res.on('end', () => {
//             const body = Buffer.concat(chunks).toString();
//             console.log('WhatsApp API response:', body);
//           });
//         });

//         req.on('error', (error) => {
//           console.error('WhatsApp API request error:', error);
//         });

//         req.end();
//       }

//       // Send SMS template via MSG91 API
//       // try {
//       //   if (mobileNumber && updated.membershipId) {
//       //     await sendSmsViaMsg91(mobileNumber, updated.membershipId);
//       //   }
//       // } catch (smsErr) {
//       //   console.log('MSG91 SMS Template send failed:', smsErr?.response?.data || smsErr.message);
//       // }

//       return res.redirect(`http://localhost:5174/payment-success?merchantOrderId=${merchantOrderId}`);
//       // return res.redirect(`https://www.madaramahasabha.com/payment-success?merchantOrderId=${merchantOrderId}`);
//     } else {
//       await MembershipSubmission.findOneAndUpdate(
//         { _id: merchantOrderId },
//         {
//           'paymentResult.status': 'FAILED',
//           'paymentResult.phonepeResponse': response
//         }
//       );
//       return res.redirect(`http://localhost:5174/payment-failure?merchantOrderId=${merchantOrderId}`);
//       // return res.redirect(`https://www.madaramahasabha.com/payment-failure?merchantOrderId=${merchantOrderId}`);
//     }
//   } catch (error) {
//     console.log('error while Payment', error);
//     res.status(500).send('Internal server error during payment status check');
//   }
// };




exports.getStatusOfPayment = async (req, res) => {
  console.log('getStatusOfPayment invoked with query:', req.query);

  try {
    const { merchantOrderId } = req.query;
    if (!merchantOrderId) {
      return res.status(400).send("MerchantOrderId is required");
    }

    const response = await client.getOrderStatus(merchantOrderId);
    const status = response.state;

    if (status === 'COMPLETED') {
      const updated = await MembershipSubmission.findOneAndUpdate(
        { _id: merchantOrderId },
        {
          'paymentResult.status': 'COMPLETED',
          'paymentResult.paymentDate': new Date(),
          'paymentResult.phonepeResponse': response
        },
        { new: true }
      );

      if (!updated) {
        return res.status(404).send("Membership submission not found");
      }

      // Extract mobile number
      let mobileNumber = '';
      if (Array.isArray(updated.values)) {
        const mobileField = updated.values.find(v =>
          (v.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v.label))) ||
          (v._doc && v._doc.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v._doc.label)))
        );
        if (mobileField) mobileNumber = (mobileField.value || mobileField._doc?.value || '').toString().trim();
      }

      // Normalize mobile number to E.164 format with '+'
      if (mobileNumber) {
        const digits = mobileNumber.replace(/\D/g, '');
        if (digits.length === 10) {
          mobileNumber = `+91${digits}`;
        } else if (digits.startsWith('91') && digits.length === 12) {
          mobileNumber = `+${digits}`;
        } else if (mobileNumber.startsWith('+')) {
          // already properly formatted
        } else {
          mobileNumber = `+${digits}`; // fallback
        }
      } else {
        console.log('No valid mobile number found for WhatsApp message');
      }

      console.log('mobileNumber_normalized', mobileNumber);

      if (mobileNumber) {
        const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '462122ASu5sdOuq6889b2bcP1';
        const membershipId = updated.membershipId || '';

        // Bulk message payload as per your initial template curl example
        const messagePayload = {
          integrated_number: "15558848753",
          content_type: "template",
          payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
              name: "madara_mahasabha",
              language: {
                code: "en",
                policy: "deterministic"
              },
              namespace: "33b99d31_01ca_42e2_83fc_59571bba67f6",
              to_and_components: [
                {
                  to: [mobileNumber],
                  components: {
                    body_1: {
                      type: "text",
                      value: membershipId
                    }
                  }
                }
              ]
            }
          }
        };

        const apiURL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

        try {
          const axiosResponse = await axios.post(apiURL, messagePayload, {
            headers: {
              'authkey': MSG91_AUTHKEY,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            maxRedirects: 5
          });
          console.log('WhatsApp API bulk message response:', axiosResponse.data);
        } catch (error) {
          console.error('Failed to send WhatsApp bulk message:', error.response?.data || error.message || error);
        }
      }
      // Send SMS template via MSG91 API
      try {
        if (mobileNumber && updated.membershipId) {
          await sendSmsViaMsg91(mobileNumber, updated.membershipId);
        }
      } catch (smsErr) {
        console.log('MSG91 SMS Template send failed:', smsErr?.response?.data || smsErr.message);
      }

      // return res.redirect(`http://localhost:5174/payment-success?merchantOrderId=${merchantOrderId}`);
      // Replace with production URL as needed:
      return res.redirect(`https://www.madaramahasabha.com/payment-success?merchantOrderId=${merchantOrderId}`);

    } else {
      await MembershipSubmission.findOneAndUpdate(
        { _id: merchantOrderId },
        {
          'paymentResult.status': 'FAILED',
          'paymentResult.phonepeResponse': response,
        }
      );
      // return res.redirect(`http://localhost:5174/payment-failure?merchantOrderId=${merchantOrderId}`);
      // Replace with production URL as needed:
      return res.redirect(`https://www.madaramahasabha.com/payment-failure?merchantOrderId=${merchantOrderId}`);
    }
  } catch (error) {
    console.error('Error while checking payment status:', error);
    return res.status(500).send('Internal server error during payment status check');
  }
};
// Redirect QR scans to the public frontend user details page
exports.redirectToUserMembershipPage = async (req, res) => {
  try {
    const { membershipId } = req.params;
    if (!membershipId) return res.status(400).send('membershipId is required');

    // Basic existence check to avoid redirecting to 404 for obvious typos
    // but do not block redirect if DB temporarily unavailable
    try {
      let exists = null;
      if (mongoose.Types.ObjectId.isValid(membershipId)) {
        exists = await MembershipSubmission.findById(membershipId).select('_id membershipId');
      }
      if (!exists) {
        exists = await MembershipSubmission.findOne({ membershipId }).select('_id membershipId');
      }
      if (!exists) {
        // Still redirect; frontend can show a friendly not-found page
        console.warn('QR redirect: membership not found for', membershipId);
      }
    } catch (e) {
      console.warn('QR redirect existence check failed:', e?.message);
    }

    const frontendBase = process.env.FRONTEND_BASE_URL || 'https://www.madaramahasabha.com';
    const redirectUrl = `${frontendBase}/user/${encodeURIComponent(membershipId)}`;
    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Error in redirectToUserMembershipPage:', error);
    return res.status(500).send('Internal server error');
  }
};



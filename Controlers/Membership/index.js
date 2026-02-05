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
    const { formId, district, taluk, adhar_no, email, bloodGroup, referredBy, values, paymentResult } = req.body;

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
      formId,
      district,
      taluk,
      adhar_no,
      email,
      bloodGroup,
      referredBy: referredBy || '',
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
      membershipId: null,
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
    let { district, taluk, search, page, size } = req.query;
    const query = {};

    // Optional filter by district
    if (district && district !== "30") {
      if (mongoose.Types.ObjectId.isValid(district)) {
        query.district = new mongoose.Types.ObjectId(district);
      } else {
        return res.json({
          currentPage: 1,
          items: [],
          totalItems: 0,
          totalPages: 0,
        });
      }
    }

    // Filter by taluk
    if (taluk && taluk !== "30") {
      if (mongoose.Types.ObjectId.isValid(taluk)) {
        query.taluk = new mongoose.Types.ObjectId(taluk);
      } else {
        return res.json({
          currentPage: 1,
          items: [],
          totalItems: 0,
          totalPages: 0,
        });
      }
    }

    // Only include successful payments
    query['paymentResult.status'] = 'COMPLETED';

    // Pagination setup - always 50 items per page
    const pageInt = page ? Math.max(1, parseInt(page)) : 1;
    const finalSize = 50; // Fixed at 50 items per page

    // Search functionality - optimized to search in indexed fields first
    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      const searchRegex = new RegExp(searchTerm, "i");
      
      // Search in indexed fields first (much faster)
      query.$or = [
        { membershipId: searchRegex },
        { adhar_no: searchRegex },
        { email: searchRegex },
        { referredBy: searchRegex },
      ];
    }

    // Optimized: Get count and data separately for better performance
    // Count query with timeout
    const totalItems = await MembershipSubmission.countDocuments(query).maxTimeMS(5000);

    // Data query - optimized aggregation pipeline
    // Sort early and use index efficiently
    const pipeline = [
      { $match: query },
      { $sort: { submittedAt: -1 } }, // Sort before skip/limit for index usage
      { $skip: (pageInt - 1) * finalSize },
      { $limit: finalSize },
      {
        $lookup: {
          from: "districts",
          localField: "district",
          foreignField: "_id",
          as: "district",
          pipeline: [{ $project: { name: 1, k_name: 1 } }]
        }
      },
      {
        $lookup: {
          from: "taluks",
          localField: "taluk",
          foreignField: "_id",
          as: "taluk",
          pipeline: [{ $project: { name: 1, k_name: 1 } }]
        }
      },
      {
        $addFields: {
          district: { $arrayElemAt: ["$district", 0] },
          taluk: { $arrayElemAt: ["$taluk", 0] }
        }
      },
      {
        $project: {
          membershipId: 1,
          adhar_no: 1,
          email: 1,
          bloodGroup: 1,
          referredBy: 1,
          district: 1,
          taluk: 1,
          values: 1,
          paymentResult: 1,
          submittedAt: 1
        }
      }
    ];

    // Execute aggregation with timeout (using options for compatibility)
    let submissions = await MembershipSubmission.aggregate(pipeline)
      .option({ allowDiskUse: true, maxTimeMS: 10000 }); // 10 second timeout

    // Convert ObjectIds to strings for consistency
    submissions = submissions.map(sub => ({
      ...sub,
      _id: sub._id?.toString(),
      district: sub.district?._id ? { ...sub.district, _id: sub.district._id.toString() } : sub.district,
      taluk: sub.taluk?._id ? { ...sub.taluk, _id: sub.taluk._id.toString() } : sub.taluk,
    }));

    // Collect all media IDs to batch fetch
    const allMediaIds = [];
    submissions.forEach(submission => {
      if (submission.values && Array.isArray(submission.values)) {
        submission.values.forEach(val => {
          if (val.media && Array.isArray(val.media) && val.media.length > 0) {
            allMediaIds.push(...val.media);
          }
        });
      }
    });

    // Batch fetch all media in one query
    let mediaMap = new Map();
    if (allMediaIds.length > 0) {
      const uniqueMediaIds = [...new Set(allMediaIds.map(id => id.toString()))];
      const mediaDocs = await Media.find({ _id: { $in: uniqueMediaIds } })
        .select("_id name image_url doc_url video_url extension size")
        .lean()
        .maxTimeMS(5000);
      
      mediaDocs.forEach(media => {
        mediaMap.set(media._id.toString(), media);
      });
    }

    // Map media to values efficiently
    const response = submissions.map(submission => {
      const populatedValues = (submission.values || []).map(val => {
        if (val.media && Array.isArray(val.media) && val.media.length > 0) {
          const mediaDocs = val.media
            .map(id => {
              const idStr = id.toString ? id.toString() : String(id);
              return mediaMap.get(idStr);
            })
            .filter(Boolean);
          return { ...val, media: mediaDocs };
        }
        return val;
      });
      return { ...submission, values: populatedValues };
    });

    res.json({
      currentPage: pageInt,
      items: response,
      totalItems,
      totalPages: Math.ceil(totalItems / finalSize),
    });
  } catch (error) {
    console.error("Error fetching filtered membership submissions:", error);
    if (error.name === 'MongoTimeoutError' || error.message.includes('timeout')) {
      res.status(504).json({ message: "Request timeout. Please try again or use search/filters to narrow down results.", error: "Timeout" });
    } else {
      res.status(500).json({ message: "Error fetching submissions", error: error.message });
    }
  }
};

// Admin: Get all matching submissions for export (no pagination; supports manualOnly = manually uploaded only)
const EXPORT_MAX_LIMIT = 500000000000;
exports.getMembershipsForExport = async (req, res) => {
  try {
    let { district, taluk, search, manualOnly } = req.query;
    const query = {};

    if (district && district !== "30") {
      if (mongoose.Types.ObjectId.isValid(district)) {
        query.district = new mongoose.Types.ObjectId(district);
      } else {
        return res.json({ items: [] });
      }
    }

    if (taluk && taluk !== "30") {
      if (mongoose.Types.ObjectId.isValid(taluk)) {
        query.taluk = new mongoose.Types.ObjectId(taluk);
      } else {
        return res.json({ items: [] });
      }
    }

    // manualOnly = only manually uploaded (membershipId starts with ★, e.g. ★G-3984)
    const MANUAL_PREFIX = '\u2605'; // ★ (Black Star)
    if (manualOnly === 'true' || manualOnly === '1') {
      query.membershipId = { $regex: `^${MANUAL_PREFIX}` };
    } else {
      query['paymentResult.status'] = 'COMPLETED';
    }

    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      const searchRegex = new RegExp(searchTerm, "i");
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { membershipId: searchRegex },
          { adhar_no: searchRegex },
          { email: searchRegex },
          { referredBy: searchRegex },
        ],
      });
    }

    const pipeline = [
      { $match: query },
      { $sort: { submittedAt: -1 } },
      { $limit: EXPORT_MAX_LIMIT },
      {
        $lookup: {
          from: "districts",
          localField: "district",
          foreignField: "_id",
          as: "district",
          pipeline: [{ $project: { name: 1, k_name: 1 } }]
        }
      },
      {
        $lookup: {
          from: "taluks",
          localField: "taluk",
          foreignField: "_id",
          as: "taluk",
          pipeline: [{ $project: { name: 1, k_name: 1 } }]
        }
      },
      {
        $addFields: {
          district: { $arrayElemAt: ["$district", 0] },
          taluk: { $arrayElemAt: ["$taluk", 0] }
        }
      },
      {
        $project: {
          membershipId: 1,
          adhar_no: 1,
          email: 1,
          bloodGroup: 1,
          referredBy: 1,
          district: 1,
          taluk: 1,
          values: 1,
          paymentResult: 1,
          submittedAt: 1
        }
      }
    ];

    let submissions = await MembershipSubmission.aggregate(pipeline)
      .option({ allowDiskUse: true, maxTimeMS: 60000 });

    submissions = submissions.map(sub => ({
      ...sub,
      _id: sub._id?.toString(),
      district: sub.district?._id ? { ...sub.district, _id: sub.district._id.toString() } : sub.district,
      taluk: sub.taluk?._id ? { ...sub.taluk, _id: sub.taluk._id.toString() } : sub.taluk,
    }));

    const allMediaIds = [];
    submissions.forEach(submission => {
      if (submission.values && Array.isArray(submission.values)) {
        submission.values.forEach(val => {
          if (val.media && Array.isArray(val.media) && val.media.length > 0) {
            allMediaIds.push(...val.media);
          }
        });
      }
    });

    let mediaMap = new Map();
    if (allMediaIds.length > 0) {
      const uniqueMediaIds = [...new Set(allMediaIds.map(id => id.toString()))];
      const mediaDocs = await Media.find({ _id: { $in: uniqueMediaIds } })
        .select("_id name image_url doc_url video_url extension size")
        .lean()
        .maxTimeMS(10000);
      mediaDocs.forEach(media => {
        mediaMap.set(media._id.toString(), media);
      });
    }

    const response = submissions.map(submission => {
      const populatedValues = (submission.values || []).map(val => {
        if (val.media && Array.isArray(val.media) && val.media.length > 0) {
          const mediaDocs = val.media
            .map(id => {
              const idStr = id.toString ? id.toString() : String(id);
              return mediaMap.get(idStr);
            })
            .filter(Boolean);
          return { ...val, media: mediaDocs };
        }
        return val;
      });
      return { ...submission, values: populatedValues };
    });

    res.json({ items: response });
  } catch (error) {
    console.error("Error in getMembershipsForExport:", error);
    if (error.name === 'MongoTimeoutError' || error.message.includes('timeout')) {
      res.status(504).json({ message: "Export timeout. Try narrowing filters.", error: "Timeout" });
    } else {
      res.status(500).json({ message: "Error exporting submissions", error: error.message });
    }
  }
};


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

      // Generate membershipId if not already set
      let ensuredMembershipId = updated.membershipId;
      if (!ensuredMembershipId) {
        // Determine membership amount from saved values (default 500)
        let membershipAmount = 500;
        try {
          const amountEntry = Array.isArray(updated.values)
            ? updated.values.find(v => v && v.label === 'Membership Amount')
            : null;
          if (amountEntry && amountEntry.value) {
            const parsed = parseInt(amountEntry.value);
            if (!Number.isNaN(parsed)) membershipAmount = parsed;
          }
        } catch (e) {
          // keep default
        }

        try {
          ensuredMembershipId = await getNextMembershipId(membershipAmount);
          await MembershipSubmission.findByIdAndUpdate(
            merchantOrderId,
            { membershipId: ensuredMembershipId },
            { new: false }
          );
        } catch (e) {
          console.error('Failed to assign membershipId post-payment:', e?.message || e);
        }
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
        const membershipId = ensuredMembershipId || updated.membershipId || '';

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
        if (mobileNumber && (ensuredMembershipId || updated.membershipId)) {
          await sendSmsViaMsg91(mobileNumber, ensuredMembershipId || updated.membershipId);
        }
      } catch (smsErr) {
        console.log('MSG91 SMS Template send failed:', smsErr?.response?.data || smsErr.message);
      }

      // return res.redirect(`http://localhost:5174/payment-success?merchantOrderId=${merchantOrderId}`);
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
// Admin: Send membership card link via WhatsApp (msg91 bulk template "card")
exports.sendCardViaWhatsApp = async (req, res) => {
  try {
    const { membershipId } = req.body;
    if (!membershipId) {
      return res.status(400).json({ message: 'membershipId is required' });
    }

    const submission = await MembershipSubmission.findOne({ membershipId })
      .populate('district', 'name')
      .populate('taluk', 'name')
      .lean();
    if (!submission) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    let mobileNumber = '';
    const values = submission.values || [];
    const mobileField = values.find(
      (v) =>
        (v.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v.label))) ||
        (v._doc && v._doc.label && /mobile|phone|ಫೋನ್|ಮೊಬೈಲ್/i.test(String(v._doc.label)))
    );
    if (mobileField) {
      mobileNumber = (mobileField.value || mobileField._doc?.value || '').toString().trim();
    }

    if (!mobileNumber) {
      return res.status(400).json({ message: 'No mobile number found for this membership' });
    }

    const digits = mobileNumber.replace(/\D/g, '');
    if (digits.length === 10) {
      mobileNumber = `+91${digits}`;
    } else if (digits.startsWith('91') && digits.length === 12) {
      mobileNumber = `+${digits}`;
    } else if (!mobileNumber.startsWith('+')) {
      mobileNumber = `+${digits}`;
    }

    const frontendBase = process.env.FRONTEND_BASE_URL || 'https://www.madaramahasabha.com';
    const cardLink = `${frontendBase}/membership/user/${encodeURIComponent(membershipId)}`;

    const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '462122ASu5sdOuq6889b2bcP1';
    const messagePayload = {
      integrated_number: process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || '15558848753',
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: 'card_link',
          language: {
            code: 'kn',
            policy: 'deterministic'
          },
          namespace: '33b99d31_01ca_42e2_83fc_59571bba67f6',
          to_and_components: [
            {
              to: [mobileNumber],
              components: {
                body_1: {
                  type: 'text',
                  value: cardLink
                }
              }
            }
          ]
        }
      }
    };

    const apiURL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
    const axiosResponse = await axios.post(apiURL, messagePayload, {
      headers: {
        authkey: MSG91_AUTHKEY,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      maxRedirects: 5
    });

    console.log('WhatsApp card link sent:', membershipId, axiosResponse.data);
    return res.status(200).json({
      message: 'Card link sent via WhatsApp',
      membershipId,
      cardLink
    });
  } catch (error) {
    console.error('Send card via WhatsApp error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || error.message || 'Failed to send card via WhatsApp';
    return res.status(status).json({ message });
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

    const frontendBase = 'https://www.madaramahasabha.com';
    // Frontend route expects /membership/user/:membershipId
    const redirectUrl = `${frontendBase}/membership/user/${encodeURIComponent(membershipId)}`;
    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Error in redirectToUserMembershipPage:', error);
    return res.status(500).send('Internal server error');
  }
};

// Admin: Get district and taluk level statistics
exports.getDistrictTalukStatistics = async (req, res) => {
  try {
    // Get only submissions with successful payment (COMPLETED status)
    const submissions = await MembershipSubmission.find({
      'paymentResult.status': 'COMPLETED'
    })
      .populate('district', 'name k_name')
      .populate('taluk', 'name k_name')
      .lean();

    // Group by district
    const districtStats = {};
    const talukStats = {};

    submissions.forEach((submission) => {
      if (!submission.district || !submission.taluk) return;

      const districtId = submission.district._id.toString();
      const districtName = submission.district.name || submission.district.k_name || 'Unknown';
      const districtKName = submission.district.k_name || submission.district.name || 'Unknown';

      const talukId = submission.taluk._id.toString();
      const talukName = submission.taluk.name || submission.taluk.k_name || 'Unknown';
      const talukKName = submission.taluk.k_name || submission.taluk.name || 'Unknown';

      // District statistics
      if (!districtStats[districtId]) {
        districtStats[districtId] = {
          districtId,
          districtName,
          districtKName,
          totalMemberships: 0,
          taluks: {},
        };
      }
      districtStats[districtId].totalMemberships++;

      // Taluk statistics within district
      if (!districtStats[districtId].taluks[talukId]) {
        districtStats[districtId].taluks[talukId] = {
          talukId,
          talukName,
          talukKName,
          count: 0,
        };
      }
      districtStats[districtId].taluks[talukId].count++;

      // Overall taluk statistics (across all districts)
      if (!talukStats[talukId]) {
        talukStats[talukId] = {
          talukId,
          talukName,
          talukKName,
          districtId,
          districtName,
          districtKName,
          count: 0,
        };
      }
      talukStats[talukId].count++;
    });

    // Convert to arrays
    const districtArray = Object.values(districtStats).map((district) => ({
      ...district,
      taluks: Object.values(district.taluks),
    }));

    const talukArray = Object.values(talukStats);

    // Calculate totals
    const totalDistricts = districtArray.length;
    const totalTaluks = talukArray.length;
    const totalMemberships = submissions.length;

    res.json({
      summary: {
        totalDistricts,
        totalTaluks,
        totalMemberships,
      },
      districtStats: districtArray,
      talukStats: talukArray,
    });
  } catch (error) {
    console.error('Error fetching district/taluk statistics:', error);
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
};



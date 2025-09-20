const Media = require('../../Modals/Media');
const District = require('../../Modals/District');
const Taluk = require('../../Modals/Taluk');
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

    // Required field validation
    if (!formId) return res.status(400).json({ message: "Form ID is required" });
    if (!district) return res.status(400).json({ message: "District is required" });
    if (!taluk) return res.status(400).json({ message: "Taluk is required" });
    if (!adhar_no) return res.status(400).json({ message: "Adhar number is required" });
    if (!Array.isArray(values)) return res.status(400).json({ message: "Values array is required" });

    // Prevent duplicate Aadhaar number
    const existingAdhar = await MembershipSubmission.findOne({ adhar_no });
    if (existingAdhar) {
      return res.status(400).json({ message: "A membership with this Adhar number already exists." });
    }

    // Extract membership amount, default to 500
    const membershipAmountEntry = values.find(v => v.label === "Membership Amount");
    const membershipAmount = membershipAmountEntry ? parseInt(membershipAmountEntry.value) : 500;

    // Generate sequential membership ID with prefix (implement this utility)
    const membershipId = await getNextMembershipId(membershipAmount);

    // Process values array and extract media IDs
    const processedValues = values.map((item) => {
      if (Array.isArray(item.value) && item.value.length > 0 && item.value[0] !== null) {
        return {
          label: item.label,
          value: item.value,
          media: item.value.filter((id) => id !== null),
        };
      } else {
        return {
          label: item.label,
          value: item.value,
          media: item.media || [],
        };
      }
    });

    // Create submission document and save before payment
    const submission = new MembershipSubmission({
      membershipId,
      formId,
      district,
      taluk,
      adhar_no,
      email,
      bloodGroup,
      values: processedValues,
      submittedAt: new Date(),
    });

    await submission.save();

    // Setup payment redirect
    // const redirectUrl = `http://localhost:5000/membership/check-status?merchantOrderId=${membershipId}`;
    const redirectUrl = `https://www.madaramahasabha.com/api/membership/check-status?merchantOrderId=${membershipId}`;

    const request = StandardCheckoutPayRequest
      .builder(membershipId)
      .amount(membershipAmount)
      .redirectUrl(redirectUrl)
      .build();

    const paymentResponse = await client.pay(request);

    // Unified response (no code after return)
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



// User: Get a membership submission by membershipId
exports.getMembershipById = async (req, res) => {
  try {
    const { membershipId } = req.params;

    const submission = await MembershipSubmission.findOne({ membershipId })
      .populate('district', 'name k_name')
      .populate('taluk', 'name k_name');

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


exports.getStatusOfPayment = async (req, res) => {
  console.log('getStatusOfPayment invoked with query:', req.query);

  try {
    const { merchantOrderId } = req.query;
    if (!merchantOrderId) {
      return res.status(400).send("MerchantOrderId is required");
    }
    const responce = await client.getOrderStatus(merchantOrderId);
    const status = responce.state;

    // Update paymentResult.status before redirecting
    if (status === 'COMPLETED') {
      await MembershipSubmission.findOneAndUpdate(
        { membershipId: merchantOrderId },
        { 
          'paymentResult.status': 'COMPLETED' // update to capital since your provider returns this
        }
      );
      return res.redirect('https://www.madaramahasabha.com/payment-success');
    } else {
      await MembershipSubmission.findOneAndUpdate(
        { membershipId: merchantOrderId },
        { 
          'paymentResult.status': 'FAILURE'
        }
      );
      return res.redirect('https://www.madaramahasabha.com/payment-failure');
    }

  } catch (error) {
   console.log('error while Payment', error);
  }
};
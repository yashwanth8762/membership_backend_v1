const { MembershipForm, MembershipSubmission } = require('../../Modals/Membership');
const Media = require('../../Modals/Media');
const District = require('../../Modals/District');
const Taluk = require('../../Modals/Taluk');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Admin: Create a new membership form structure
exports.createForm = async (req, res) => {
  try {
    let { fields } = req.body;
    // Ensure each field has both label and label_kn
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

// User: Submit a membership form
// exports.submitMembership = async (req, res) => {
//   try {
//     const { formId, district, taluk, values } = req.body;
    
//     // Validate required fields
//     if (!formId) {
//       return res.status(400).json({ message: 'Form ID is required' });
//     }
    
//     if (!district) {
//       return res.status(400).json({ message: 'District is required' });
//     }
    
//     if (!taluk) {
//       return res.status(400).json({ message: 'Taluk is required' });
//     }
    
//     // Generate a random membershipId
//     const membershipId = crypto.randomBytes(8).toString('hex');
    
//     // Process values to separate media IDs from regular values
//     const processedValues = values.map(item => {
//       if (Array.isArray(item.value) && item.value.length > 0 && item.value[0] !== null) {
//         // This is a media field, store media IDs in media array
//         return {
//           label: item.label,
//           value: item.value, // Keep the array as value
//           media: item.value.filter(id => id !== null) // Store non-null IDs in media array
//         };
//       } else {
//         // This is a regular field
//         return {
//           label: item.label,
//           value: item.value,
//           media: item.media || [] // Use provided media array or empty array
//         };
//       }
//     });

//     const submission = new MembershipSubmission({
//       membershipId,
//       formId,
//       district,
//       taluk,
//       values: processedValues,
//     });
//     await submission.save();
//     res.status(201).json({ membershipId, submission });
//   } catch (error) {
//     console.error('Error in submitMembership:', error);
//     res.status(500).json({ message: 'Error submitting membership', error: error.message });
//   }
// };


exports.submitMembership = async (req, res) => {
  try {
    const { formId, district, taluk, adhar_no, email, bloodGroup, values } = req.body;

    if (!formId) return res.status(400).json({ message: "Form ID is required" });
    if (!district) return res.status(400).json({ message: "District is required" });
    if (!taluk) return res.status(400).json({ message: "Taluk is required" });
    if (!adhar_no) return res.status(400).json({ message: "Adhar number is required" });
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!Array.isArray(values)) return res.status(400).json({ message: "Values array is required" });

    const existingAdhar = await MembershipSubmission.findOne({ adhar_no });
    if (existingAdhar) {
      return res.status(400).json({ message: "A membership with this Adhar number already exists." });
    }

    const membershipId = crypto.randomBytes(8).toString("hex");

    // Process values array: separate media from normal values
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

    const submission = new MembershipSubmission({
      membershipId,
      formId,
      district,
      taluk,
      adhar_no,
      email,
      bloodGroup,
      values: processedValues,
    });

    await submission.save();

    res.status(201).json({ membershipId, submission });
  } catch (error) {
    console.error("Error in submitMembership:", error);
    res.status(500).json({ message: "Error submitting membership", error: error.message });
  }
};

// User: Get a membership submission by membershipId
exports.getMembershipById = async (req, res) => {
  try {
    const { membershipId } = req.params;
    console.log('Fetching membership with ID:', membershipId);
    
    const submission = await MembershipSubmission.findOne({ membershipId })
      .populate('district', 'name k_name')
      .populate('taluk', 'name k_name');
      
    if (!submission) {
      console.log('Membership not found for ID:', membershipId);
      return res.status(404).json({ message: 'Membership not found' });
    }

    console.log('Found submission:', submission);
    console.log('Submission values:', submission.values);

    // Populate media details for each value that has media
    const populatedValues = await Promise.all(
      submission.values.map(async (value) => {
        console.log(`Processing value for label: ${value.label}, media:`, value.media);
        
        if (value.media && value.media.length > 0) {
          console.log(`Found media IDs for ${value.label}:`, value.media);
          
          // Fetch media details for each media ID
          const mediaDetails = await Promise.all(
            value.media.map(async (mediaId) => {
              try {
                console.log(`Fetching media with ID: ${mediaId}`);
                const media = await Media.findById(mediaId);
                console.log(`Media found for ID ${mediaId}:`, media);
                
                if (media) {
                  return {
                    id: media._id,
                    name: media.name,
                    image_url: media.image_url,
                    doc_url: media.doc_url,
                    video_url: media.video_url,
                    extension: media.extension,
                    size: media.size
                  };
                }
                return null;
              } catch (err) {
                console.error(`Error fetching media ${mediaId}:`, err);
                return null;
              }
            })
          );
          
          console.log(`Media details for ${value.label}:`, mediaDetails);
          
          return {
            ...value,
            media: mediaDetails.filter(media => media !== null)
          };
        }
        return value;
      })
    );

    console.log('Populated values:', populatedValues);

    // Create response with populated media, district, and taluk
    const response = {
      ...submission.toObject(),
      values: populatedValues,
      district: submission.district,
      taluk: submission.taluk
    };

    console.log('Final response:', response);
    res.json(response);
  } catch (error) {
    console.error('Error in getMembershipById:', error);
    res.status(500).json({ message: 'Error fetching membership', error: error.message });
  }
}; 
exports.getMembershipsFiltered = async (req, res) => {
  try {
    let { district, taluk } = req.query;
    const query = {};

    // Convert string IDs to ObjectId if needed
    if (district && district !== "30") {
      if (mongoose.Types.ObjectId.isValid(district)) {
        query.district = new mongoose.Types.ObjectId(district);
      } else {
        // Invalid id, return empty result early
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

    // Optionally filter by a field in the values array (uncomment if needed)
    // query["values.label"] = "ID card";

    console.log("Running query:", query);

    const submissions = await MembershipSubmission.find(query)
      .populate("district", "name k_name")
      .populate("taluk", "name k_name")
      .lean();

    console.log("Number of submissions found:", submissions.length);

    // Deeply populate media arrays inside 'values'
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
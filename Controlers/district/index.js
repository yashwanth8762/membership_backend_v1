const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");
const FUNCTION = require("../../utils/functions");

const District = require("../../Modals/District");
const Taluk = require("../../Modals/Taluk");
const mongoose = require('mongoose');
const { validationResult } = require("express-validator");

const jwt = require("jsonwebtoken");

module.exports.createDistrict = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const token = req.get("Authorization");
  let decodedToken = await jwt.decode(token);

  if (decodedToken.role != "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
  }

  // CHECK ENTITY COUNT

  const entity_count = await FUNCTION.getThisEntityCount("DISTRICT");
  if (entity_count === false) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
    });
  }

  // CREATE NEW DISTRICT OBJECT

  const district = new District({
    name: req.body.name,
    k_name: req.body.k_name,
    district_id: entity_count + 1,
  });

  try {
    // SAVE DISTRICT OBJECT TO COLLECTION

    const savedDistrict = await district.save();

    try {
      // UPDATE ENTITY COUNT

      const saveEntityCount = await FUNCTION.updateThisEntityCount("DISTRICT");
      if (saveEntityCount === false) {
        return res.status(STATUS.BAD_REQUEST).json({
          message: MESSAGE.internalServerError,
        });
      }

      return res.status(STATUS.CREATED).json({
        id: savedDistrict.id,
        message: 'District Created Successfully',
      });
    } catch (error) {
      //console.log(error);
      return res.status(STATUS.BAD_REQUEST).json({
        message: MESSAGE.internalServerError,
      });
    }
  } catch (error) {
    //console.log(error);
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
    });
  }
};

module.exports.getDistricts = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const token = req.get("Authorization");
  let decodedToken = await jwt.decode(token);

  if (decodedToken.role != "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
  }

  //Set Status From Request Query

  let status = true;

  if (req.query.status === undefined || req.query.status === "") {
    status = null;
  } else {
    if (req.query.status != "false" && req.query.status != "true") {
      status = true;
    } else {
      let query_status = JSON.parse(req.query.status);
      status = query_status;
    }
  }

  //Set Pagination Configurations

  let pageInt;
  let sizeInt;
  const page = req.query.page;
  const size = req.query.size;

  if (size != undefined) {
    sizeInt = parseInt(size);
  } else {
    sizeInt = 10;
  }

  if (page != undefined) {
    pageInt = parseInt(page);
  } else {
    pageInt = 1;
  }

  //Set Sorting Configurations

  let sort;

  if (req.query.sort === undefined || req.query.sort === "") {
    sort = -1;
  } else {
    if (req.query.sort != "-1" && req.query.sort != "1") {
      sort = -1;
    } else {
      sort = parseInt(req.query.sort);
    }
  }

  try {
    let documentCount = 0;
    let districts = [];

    if (status === null) {
      documentCount = await District.countDocuments({ is_archived: false });

      console.log(documentCount);
      districts = await District.find(
        { is_archived: false },
        { id: 1, district_id: 1, name: 1, k_name: 1, is_active: 1 }
      )
        .skip((pageInt - 1) * sizeInt)
        .limit(sizeInt)
        .sort({ district_id: 1 })
        .exec();
    } else {
      documentCount = await District.find({
        is_active: status,
        is_archived: false,
      }).countDocuments();
      districts = await District.find(
        { is_active: status, is_archived: false },
        { id: 1, district_id: 1, name: 1, k_name: 1, is_active: 1 }
      )
        .skip((pageInt - 1) * sizeInt)
        .limit(sizeInt)
        .sort({ district_id: 1 })
        .exec();
    }

    return res.status(STATUS.SUCCESS).json({
      currentPage: pageInt,
      items: districts,
      totalItems: documentCount,
      totalPages: Math.ceil(documentCount / sizeInt),
    });
  } catch (error) {
    //console.log(error);
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.updateDistrictStatus = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const token = req.get("Authorization");
  let decodedToken = await jwt.decode(token);

  if (decodedToken.role != "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
  }

  try {
    let { id } = req.params;
    let { is_active } = req.body;

    let district = await District.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!district) {
      return res.status(STATUS.NOTFOUND).json({
        message: "District status updated",
      });
    } else {
      return res.status(STATUS.SUCCESS).json({
        id: district.id,
        name: district.name,
        k_name: district.k_name,
        is_active: district.is_active,
      });
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.archiveOrActiveDistrict = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const token = req.get("Authorization");
  let decodedToken = await jwt.decode(token);

  if (decodedToken.role != "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
  }

  try {
    let { id } = req.params;
    let { is_archived } = req.body;

    let district = await District.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!district) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "District archive updated",
      });
    } else {
      return res.status(STATUS.SUCCESS).json({
        id: district.id,
        name: district.name,
        k_name: district.k_name,
        is_archived: district.is_archived,
      });
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.getAllActiveDistricts = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  try {
    let districts = await District.find(
      { is_active: true, is_archived: false },
      { id: 1, district_id: 1, name: 1, k_name: 1 }
    );
    return res.status(STATUS.SUCCESS).json(districts);
  } catch (error) {
    //console.log(error);
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.updateDistrict = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const token = req.get("Authorization");
  let decodedToken = await jwt.decode(token);

  if (decodedToken.role != "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
  }

  try {
    let { id } = req.params;
    let k_name = req.body.k_name;
    let name = req.body.name;

    const data = {
      k_name: k_name,
      name: name,
    };

    let district = await District.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!district) {
      return res.status(STATUS.BAD_REQUEST).json({
        message: "District not updated",
      });
    } else {
      return res.status(STATUS.SUCCESS).json({
        id: district.id,
        message: "District Updated",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
    });
  }
};

module.exports.getThisDistrict = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const token = req.get("Authorization");
  let decodedToken = await jwt.decode(token);

  if (decodedToken.role != "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
  }

  try {
    let districtReq = await District.findOne({
      _id: req.params.id,
      is_archived: false,
    });
    if (districtReq != null) {
      return res.status(STATUS.SUCCESS).json({
        data: districtReq,
        message: "District Found",
      });
    } else {
      return res.status(STATUS.NOT_FOUND).json({
        message: MESSAGE.notFound,
      });
    }
  } catch (error) {
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
    });
  }
};

module.exports.getAllDistrictsForDpar = async (req, res) => {};

module.exports.getTalukByDistrict = async (req, res) => {
  try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(STATUS.BAD_REQUEST).json({
              message: "Bad request",
              errors: errors.array()
          });
      }

      const districtId = req.params.districtId;

      // Validate district ID format
      if (!mongoose.Types.ObjectId.isValid(districtId)) {
          return res.status(STATUS.BAD_REQUEST).json({
              message: "Invalid district ID format"
          });
      }

      // Check if district exists
      const district = await District.findOne({
          _id: districtId,
          is_active: true,
          is_archived: false
      });

      if (!district) {
          return res.status(STATUS.NOT_FOUND).json({
              message: "District not found or inactive"
          });
      }

      // Get all active taluks for the district
      const taluks = await Taluk.find({
          district: districtId,
          is_active: true,
          is_archived: false
      })
      .select('taluk_id name k_name district')
      .populate('district', 'name k_name')
      .sort({ name: 1 }); // Sort alphabetically by name

      if (!taluks.length) {
          return res.status(STATUS.NOT_FOUND).json({
              message: "No taluks found for this district"
          });
      }

      // Format the response
      const formattedTaluks = taluks.map(taluk => ({
          id: taluk._id,
          taluk_id: taluk.taluk_id,
          name: taluk.name,
          k_name: taluk.k_name,
          district: {
              id: taluk.district._id,
              name: taluk.district.name,
              k_name: taluk.district.k_name
          }
      }));

      return res.status(STATUS.SUCCESS).json({
          message: "Taluks retrieved successfully",
          data: {
              district: {
                  id: district._id,
                  name: district.name,
                  k_name: district.k_name
              },
              taluks: formattedTaluks
          }
      });

  } catch (error) {
      console.error('Error in getTalukByDistrict:', error);
      return res.status(STATUS.BAD_REQUEST).json({
          message: MESSAGE.internalServerError,
          error: error.message
      });
  }
};

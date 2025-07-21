require("dotenv").config();

const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");
const validations = require("../../utils/validations");

const Admin = require('../../Modals/User');
const MediaType = require('../../Modals/MediaType');

module.exports.saveNewMediaType = async (req, res) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        return res.status(STATUS.VALIDATION_FAILED).json({
            message: `Bad request`,
        });
    }

    const token = req.get('Authorization');
    let decodedToken = await jwt.decode(token);
    console.log(decodedToken.uid);

    if( decodedToken.role != "ADMIN"){
        return res.status(STATUS.UNAUTHORISED).json({
            message: MESSAGE.unauthorized,
        });
    }

    const { name, icon, max_upload_size } = req.body;

    let adminDetails = null;

    try{
        const checkUserExistanceReq = await Admin.findOne({ _id: decodedToken.uid });
        if(checkUserExistanceReq){
            adminDetails = checkUserExistanceReq;
        }
        else{
            adminDetails = null;
        }
    }
    catch(error){
        console.log(error);
        return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.badRequest,
            error
        });
    }

    const isNameValid = await validations.validateName(name);

    if(isNameValid.status === false){
        const inputs_errors = [];

        if(isNameValid.status === false){
            inputs_errors.push('NAME');
        }

        return res.status(STATUS.VALIDATION_FAILED).json({
            message: "Invalid Inputs",
            fields: inputs_errors
        });
    }

    let mediaType = new MediaType({
        name: name.toLowerCase().replaceAll(/\s/g,''),
        icon: icon,
        max_upload_size: max_upload_size,
        created_by: adminDetails.id
    });

    try{
        const savedMediaType = await mediaType.save();

        return res.status(STATUS.CREATED).json({
            message: "Media Type Created Successfully",
            data: savedMediaType.id
        });
    }
    catch(error){
        console.log(error);
        return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.badRequest,
            error
        });
    }
}

module.exports.getAllMediaTypes = async (req, res) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        return res.status(STATUS.VALIDATION_FAILED).json({
            message: `Bad request`,
        });
    }

    const token = req.get('Authorization');
    let decodedToken = await jwt.decode(token);

    if(decodedToken.role != "SUPER_ADMIN" && decodedToken.role != "ADMIN"){
        return res.status(STATUS.FORBIDDEN).json({
            message: MESSAGE.unauthorized,
        });
    }

    let pageInt;
    let sizeInt;

    const page = req.query.page;
    const size = req.query.size;

    if(!size){
        sizeInt = 10;
    }
    else{
        sizeInt = parseInt(size);
    }

    if(!page){
        pageInt = 1;
    }
    else{
        pageInt = parseInt(page);
    }

    try{
        const getMediaTypesReq = await MediaType.aggregate([
            {
                $match: { is_archived: false }
            },
            {
                $lookup: {
                    from: "admins",
                    localField: "created_by",
                    foreignField: "_id",
                    as: "created_by",
                }
            },
            {
                $addFields: {
                    created_by: {
                        $first: "$created_by"
                    }
                }
            },
            {
                $lookup: {
                    from: "media",
                    localField: "_id",
                    foreignField: "media_type",
                    pipeline: [
                        { $match: { "is_archived": false } }
                    ],
                    as: "no_of_files"
                }
            },
            {
                $project: { 
                    name: "$name",
                    icon: "$icon",
                    created_by: { 
                        id: "$created_by._id", 
                        first_name: "$created_by.first_name", 
                        last_name: "$created_by.last_name", 
                        role: "$created_by.role"
                    },
                    uploaded_files_size: { $cond: { if: { $isArray: "$no_of_files" }, then: { $sum: "$no_of_files.size.original" }, else: "NA"} },
                    optimized_files_size: { $cond: { if: { $isArray: "$no_of_files" }, then: { $sum: "$no_of_files.size.current" }, else: "NA"} },
                    no_of_files: { $cond: { if: { $isArray: "$no_of_files" }, then: { $size: "$no_of_files" }, else: "NA"} },
                    is_active: "$is_active",
                    is_archived: "$is_archived",
                    createdAt: "$createdAt",
                    updatedAt: "$updatedAt",
                }
            },
            {
                $sort: { createdAt: 1 }
            },
            { 
                $facet: {
                    metadata: [ { $count: "total" }, { $addFields: { page: parseInt(pageInt) } } ],
                    data: [ { $skip: (pageInt - 1) * sizeInt }, { $limit: sizeInt } ]
                }
            },
            {
                $set: {
                    metadata: {
                        $cond: {
                            if: { $eq: [{ $size: "$metadata" }, 0] },
                            then: [{ total: 0 }],
                            else: "$metadata"
                        }
                    }
                }
            }
        ]);

        return res.status(STATUS.SUCCESS).json({
            message: "Request successfully processed.",
            data: {
                items: getMediaTypesReq[0].data,
                total_items: getMediaTypesReq[0].metadata[0].total,
                total_pages: Math.ceil(getMediaTypesReq[0].metadata[0].total / parseInt(sizeInt)),
                current_page: getMediaTypesReq[0].metadata[0].page,
            }
        });
    }
    catch(error){
        console.log(error);
        return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.badRequest,
            error
        });
    }
}
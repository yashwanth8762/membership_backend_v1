require("dotenv").config();

const { validationResult } = require('express-validator');
const path = require('path')
const jwt = require('jsonwebtoken');
const sharp = require("sharp");
const fs = require('fs');
const { promisify } = require('util');

const execSync = require("child_process").execSync;

const Media = require('../../Modals/Media');

const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");
const validations = require("../../utils/validations");

const { allowedFileTypes, activityTypes } = require("../../utils/constants");
const MediaType = require("../../Modals/MediaType");
const User = require("../../Modals/User");

const image_mime_types = [];
const video_mime_types = [];
const document_mime_types = [];
const audio_mime_types = [];

allowedFileTypes.map((fileType) => 
    fileType.type==="image" 
    ? 
    image_mime_types.push(fileType.mimetype) 
    :
    fileType.type==="video" 
    ? 
    video_mime_types.push(fileType.mimetype) 
    :
    fileType.type==="document" 
    ? 
    document_mime_types.push(fileType.mimetype) 
    :
    fileType.type==="audio" 
    ? 
    audio_mime_types.push(fileType.mimetype) 
    : 
    console.log('')
);

const renameAsync = promisify(fs.rename);


const processSingleImage = async (image) => {

    // Extract file names and extensions only once
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
    }

    const image_metadata = await sharp(image.path).metadata();

    // Flags for resizing logic
    let set_image_width_as_max_width = false;
    let is_thumbnail_required = false;

    if (image_metadata.width > 1500) {
        set_image_width_as_max_width = true;
    } else if (image_metadata.width > 500) {
        is_thumbnail_required = true;
    }

    const image_url = image.path.replace(/\\/g, "/");
    const url_array = image_url.split("/");
    const file_name_with_ext = url_array;
    const file_name_without_ext = file_name_with_ext[2].replace(/\.[^/.]+$/, "");
    let final_file_name = file_name_without_ext.replaceAll(/\s/g, '');
    final_file_name = final_file_name.replace(/[{()}]/g, "");

    //generate final full width high res image in .webp format
    try {
        const generateHighResFullImageAsWebp = await sharp(image_url)
            .resize({ width: set_image_width_as_max_width ? 1500 : image_metadata.width })
            .toFormat('webp')
            .webp({ quality: 80 })
            .toFile(`assets/images/full/high_res/${final_file_name}.webp`);

        imageToReturn.image_url.full.high_res = `assets/images/full/high_res/${final_file_name}.webp`;
    } catch (error) {
        console.log(error);
        return {
            status: false,
            error: error.message
        };
    }

    //generate final full width low res image in .webp format
    try {
        const generateLowResFullImageAsWebp = await sharp(image_url)
            .resize({ width: set_image_width_as_max_width ? 1500 : image_metadata.width })
            .toFormat('webp')
            .webp({ quality: 60 })
            .toFile(`assets/images/full/low_res/${final_file_name}.webp`);

        imageToReturn.image_url.full.low_res = `assets/images/full/low_res/${final_file_name}.webp`;
    } catch (error) {
        console.log(error);
        return {
            status: false,
            error: error.message
        };
    }

    if (is_thumbnail_required) {
        //generate final thumbnail high res image in .webp format
        try {
            const generateHighResThumbImageAsWebp = await sharp(imageToReturn.image_url.full.high_res)
                .resize({ width: 250, height: 250, fit: 'contain', background: "#f1f5f9" })
                .toFormat('webp')
                .webp({ quality: 100 })
                .toFile(`assets/images/thumb/high_res/${final_file_name}.webp`);

            imageToReturn.image_url.thumbnail.high_res = `assets/images/thumb/high_res/${final_file_name}.webp`;
        } catch (error) {
            console.log(error);
            return {
                status: false,
                error: error.message
            };
        }

        //generate final thumbnail low res image in .webp format
        try {
            const generateLowResThumbImageAsWebp = await sharp(imageToReturn.image_url.full.high_res)
                .resize({ width: 250, height: 250, fit: 'contain', background: "#f1f5f9" })
                .toFormat('webp')
                .webp({ quality: 70 })
                .toFile(`assets/images/thumb/low_res/${final_file_name}.webp`);

            imageToReturn.image_url.thumbnail.low_res = `assets/images/thumb/low_res/${final_file_name}.webp`;
        } catch (error) {
            console.log(error);
            return {
                status: false,
                error: error.message
            };
        }
    } else {
        imageToReturn.image_url.thumbnail.high_res = imageToReturn.image_url.full.high_res;
        imageToReturn.image_url.thumbnail.low_res = imageToReturn.image_url.full.low_res;
    }

    // Get the metadata of the optimized image
    let optimized_file_metadata = await sharp(imageToReturn.image_url.full.high_res).metadata();

    imageToReturn.extension.current = optimized_file_metadata.format;
    let optimized_image = fs.statSync(imageToReturn.image_url.full.high_res)
    imageToReturn.size.current = optimized_image.size;

    // Delete original image after processing is completed
    try {
        fs.unlinkSync(image.path);
    } catch (error) {
        console.log(error);
    }

    return {
        status: true,
        data: imageToReturn
    }
}


const processSingleVideo = async (video) => {
    console.log('video', video);
}

const processSingleDocument = async (document) => {

    let original_file_name_without_extension = document.originalname.split('.');
    let original_file_extension = original_file_name_without_extension.pop();

    let current_file_name_without_extension = document.filename.split('.');
    let current_file_extension = current_file_name_without_extension.pop();

    let extension = document.filename.split('.');
    extension = extension.pop();

    let documentToReturn = {
        name: {
            original: original_file_name_without_extension[0],
            current: current_file_name_without_extension[0]
        },
        size: {
            original: document.size,
            current: 0
        },
        extension: {
            original: extension,
            current: extension
        },
        doc_url: ""
    }

    const doc_url = document.path.replace(/\\/g,"/");
    const url_array = doc_url.split("/");

    const file_name_with_ext = url_array;
    const file_name_without_ext = file_name_with_ext[2].replace(/\.[^/.]+$/, "");

    let final_file_name = file_name_without_ext.replaceAll(/\s/g,'');
    final_file_name = final_file_name.replace(/[{()}]/g, "");

    const input_file = doc_url;
    const output_file = `assets/documents/${final_file_name}.pdf`

    const result = execSync(`gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${output_file} ${input_file}`);
    
    let optimized_doc = fs.statSync(`${output_file}`);
    let uploaded_doc = fs.statSync(`${input_file}`);
    
    if(optimized_doc.size > uploaded_doc.size){
        
        fs.unlinkSync(output_file);

        try{
            const resultCopy = await renameAsync(input_file, output_file);
        }
        catch(error){
            console.log(error);
        }

        documentToReturn.size.current = uploaded_doc.size;
    }
    else{
        fs.unlinkSync(input_file);
        documentToReturn.size.current = optimized_doc.size;
    }

    documentToReturn.doc_url = output_file;

    return {
        status: true,
        data: documentToReturn
    }
}

const processSingleAudio = async (audio) => {
    console.log('audio', audio);
}

module.exports.saveMediaFile = async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(STATUS.VALIDATION_FAILED).json({
            message: `Bad request`,
        });
    }

    // Remove all authentication and user checks

    let new_media = {
        name: {
            temp: '',
            original: '',
            current: '',
            history: []
        },
        extension: {
            original: '',
            current: ''
        },
        size: {
            original: '',
            current: ''
        },
        image_url: {
            full: {
                high_res: undefined,
                low_res: undefined,
            },
            thumbnail: {
                high_res: undefined,
                low_res: undefined,
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
        media_type: '',
        uploaded_by: null, // No user
    }
    
    const isFileTypeImage = image_mime_types.includes(req.file.mimetype);
    const isFileTypeVideo = video_mime_types.includes(req.file.mimetype);
    const isFileTypeDocument = document_mime_types.includes(req.file.mimetype);
    const isFileTypeAudio = audio_mime_types.includes(req.file.mimetype);

    let processImage;
    let processVideo;
    let processDocument;
    let processAudio;

    if(isFileTypeImage){
        processImage = await processSingleImage(req.file);
        new_media.name.temp = processImage.data.name.current;
        new_media.name.original = processImage.data.name.original;
        new_media.name.current = processImage.data.name.current;

        new_media.extension.original = processImage.data.extension.original;
        new_media.extension.current = processImage.data.extension.current;

        new_media.size.original = processImage.data.size.original;
        new_media.size.current = processImage.data.size.current;

        new_media.image_url.full.high_res = processImage.data.image_url.full.high_res;
        new_media.image_url.full.low_res = processImage.data.image_url.full.low_res;
        new_media.image_url.thumbnail.high_res = processImage.data.image_url.thumbnail.high_res;
        new_media.image_url.thumbnail.low_res = processImage.data.image_url.thumbnail.low_res;
    }
    else if(isFileTypeVideo){
        processVideo = await processSingleVideo(req.file);
    }
    else if(isFileTypeDocument){
        processDocument = await processSingleDocument(req.file);
        if(processDocument.status === true){
            new_media.name.temp = processDocument.data.name.current;
            new_media.name.original = processDocument.data.name.original;
            new_media.name.current = processDocument.data.name.current;
            new_media.extension.original = processDocument.data.extension.original;
            new_media.extension.current = processDocument.data.extension.current;
            new_media.size.original = processDocument.data.size.original;
            new_media.size.current = processDocument.data.size.current;
            new_media.doc_url = processDocument.data.doc_url;
        }
        else{
            return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.badRequest
            });
        }
    }
    else if(isFileTypeAudio){
        processAudio = await processSingleAudio(req.file);
    }

    let tempMediaTypes = null;
    try{
        const getMediaTypesReq = await MediaType.find({ is_archived: false });
        tempMediaTypes = getMediaTypesReq;
    }
    catch(error){
        return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.badRequest
        });
    }

    if(isFileTypeImage){
        let thisMediaType = tempMediaTypes.find((mt) => mt.name == "image");
        new_media.media_type = thisMediaType.id;
    }
    if(isFileTypeDocument){
        let thisMediaType = tempMediaTypes.find((mt) => mt.name == "document"); 
        new_media.media_type = thisMediaType.id;
    }

    let save_media = new Media(new_media);
    try{
        const savedMedia = await save_media.save();
        if(savedMedia){
            return res.status(STATUS.CREATED).json({
                message: "Media Created Successfully",
                data: savedMedia.id
            });
        }
        else{
            return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.badRequest
            });
        }
    }
    catch(error){
        return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.badRequest,
            error
        });
    }
}

module.exports.getAllAuthFiles = async (req, res) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        
        return res.status(STATUS.VALIDATION_FAILED).json({
            message: `Bad request`,
        });
    }

    const token = req.get('Authorization');
    let decodedToken = await jwt.decode(token);

    if(decodedToken.role != "ADMIN" && decodedToken.role != "TNO" && decodedToken.role != "DC" && decodedToken.role != "DS" && decodedToken.role != "CEO" && decodedToken.role != "AR" && decodedToken.role != "US"){
        return res.status(STATUS.FORBIDDEN).json({
            message: MESSAGE.unauthorized,
        });
    }

    let pageInt;
    let sizeInt;

    const page = req.query.page;
    const size = req.query.size;

    if(!size){
        sizeInt = 12;
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

    const belongsToFolder = req.query.belongs_to_folder;

    let belongsToFilter;

    switch (belongsToFolder) {
        case "true":
            belongsToFilter = { $ne: null };
            break;
        case "false":
            belongsToFilter = false;
            break;
        default:
            belongsToFilter = { $ne: null };
    }

    const mediaTypes = req.query.media_types;

    let mediaTypesFilter;

    const mediaTypesArray = mediaTypes.split(",");

    switch (mediaTypes) {
        case "null":
            mediaTypesFilter = { $ne: null };
            break;
        case null:
            mediaTypesFilter = { $ne: null };
            break;
        case undefined:
            mediaTypesFilter = { $ne: null };
            break;
        case "":
            mediaTypesFilter = { $ne: null };
            break;
        case "ALL":
            mediaTypesFilter = { $ne: null };
            break;
        default:
            mediaTypesFilter = { $in: mediaTypesArray };
    }

    const created_on = req.query.created_on;

    let createdOnFilter;

    switch (created_on) {
        case "null":
            createdOnFilter = -1;
            break;
        case null:
            createdOnFilter = -1;
            break;
        case undefined:
            createdOnFilter = -1;
            break;
        case "":
            createdOnFilter = -1;
            break;
        case "RECENT":
            createdOnFilter = -1;
            break;
        case "OLD":
            createdOnFilter = 1;
            break;
        default:
            createdOnFilter = -1;
    }

    const created_by = req.query.created_by;

    let createdByFilter;

    switch (created_by) {
        case "null":
            createdByFilter = { $ne: null };
            break;
        case null:
            createdByFilter = { $ne: null };
            break;
        case undefined:
            createdByFilter = { $ne: null };
            break;
        case "":
            createdByFilter = { $ne: null };
            break;
        case "0":
            createdByFilter = { $ne: null };
            break;
        default:
            createdByFilter = new mongoose.Types.ObjectId(created_by);
    }

    try{
        const getFilesReq = await Media.aggregate([
            {
                $match: { is_archived: false, media_type: mediaTypesFilter, belongs_to_folder: belongsToFilter, uploaded_by: createdByFilter }
            },
            {
                $lookup: {
                    from: "admins",
                    localField: "uploaded_by",
                    foreignField: "_id",
                    as: "uploaded_by",
                }
            },
            {
                $addFields: {
                    uploaded_by: {
                        $first: "$uploaded_by"
                    }
                }
            },
            {
                $lookup: {
                    from: "media_types",
                    localField: "media_type",
                    foreignField: "_id",
                    as: "media_type",
                }
            },
            {
                $addFields: {
                    media_type: {
                        $first: "$media_type"
                    }
                }
            },
            {
                $project: { 
                    name: "$name",
                    extension: "$extension",
                    size: "$size",
                    image_url: "$image_url",
                    doc_url: "$doc_url",
                    video_url: "$video_url",
                    other_file_url: "$other_file_url",
                    alt_text: "$alt_text",
                    media_type: "$media_type",
                    uploaded_by: { 
                        id: "$uploaded_by._id", 
                        first_name: "$uploaded_by.first_name", 
                        last_name: "$uploaded_by.last_name" , 
                        role: "$uploaded_by.role" 
                    },
                    is_archived: "$is_archived",
                    createdAt: "$createdAt",
                    updatedAt: "$updatedAt",
                }
            },
            {
                $sort: { createdAt: createdOnFilter }
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

        console.log(getFilesReq);

        return res.status(STATUS.SUCCESS).json({
            message: "Request successfully processed.",
            data: {
                items: getFilesReq[0].data,
                total_items: getFilesReq[0].metadata[0].total,
                total_pages: Math.ceil(getFilesReq[0].metadata[0].total / parseInt(sizeInt)),
                current_page: getFilesReq[0].metadata[0].page,
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

module.exports.getThisAuthFile = async (req, res) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        return res.status(STATUS.VALIDATION_FAILED).json({
            message: `Bad request`,
        });
    }

    const token = req.get('Authorization');
    let decodedToken = await jwt.decode(token);

    if(decodedToken.role != "ADMIN" && decodedToken.role != "TNO" && decodedToken.role != "DC" && decodedToken.role != "DS" && decodedToken.role != "CEO" && decodedToken.role != "AR" && decodedToken.role != "DHO"){
        return res.status(STATUS.UNAUTHORISED).json({
            message: MESSAGE.unauthorized,
        });
    }

    try{
        const file = await Media.findOne({ _id: req.params.id, is_archived: false }, { name: 1, size: 1, extension: 1, image_url: 1, video_url: 1, doc_url: 1, other_file_url: 1, media_type: 1 });
        if(!file){
            return res.status(STATUS.NOT_FOUND).json({
                message: MESSAGE.notFound
            });
        }

        let filePath;
        let contentType;

        // Determine file path and content type based on media type or extension
        if (file.extension.current === "pdf" || file.extension.original === "pdf") {
            filePath = path.join(__dirname, '..' , '..' , file.doc_url); 
            contentType = 'application/pdf';
        } else if (file.image_url?.full?.high_res) {
            filePath = path.join(__dirname, '..' , '..' , file.image_url.full.high_res);
            contentType = `image/${file.extension.current}`;
        } else if (file.video_url?.video) {
            filePath = path.join(__dirname, '..' , '..' , file.video_url.video);
            contentType = `video/${file.extension.current}`;
        } else if (file.other_file_url) {
            filePath = path.join(__dirname, '..' , '..' , file.other_file_url);
            contentType = 'application/octet-stream'; 
        } else {
            return res.status(STATUS.NOT_FOUND).json({
                message: "File URL not available"
            });
        }

        // Check if file exists before sending
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error("File not found:", filePath, err);
                return res.status(STATUS.NOT_FOUND).json({
                    message: "File not found on server."
                });
            }

            res.setHeader('Content-Type', contentType);
            res.sendFile(filePath);
        });

    }
    catch(error){
        console.error("Error serving file:", error);
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
            message: MESSAGE.internalServerError,
            error
        });
    }
};
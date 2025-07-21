const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { allowedFileTypes } = require("../../utils/constants");
const isAuth = require('../../authentication/is-auth');
const mediaController = require('../../Controlers/media');

const mime_types = [];
allowedFileTypes.map((fileType) => mime_types.push(fileType.mimetype));

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

/* File Storage Settings */
const fileStorage = multer.diskStorage({ 
    destination: (req, file, cb) => {
        cb(null, 'assets/temp_resources');
    },
    filename: (req, file, cb) => {
        console.log(file)
        cb(null, uuidv4() + '-' + file.originalname);
    }
});

/* File Filter Settings */
const fileFilter = (req, file, cb) => {
    const isFileTypeValid = mime_types.includes(file.mimetype);
    if (isFileTypeValid === true) {
        cb(null, true);
    }
    else {
        cb(null, false);
    }
}

const upload = multer({
    storage: fileStorage,
    limits: {
        fileSize: 1024 * 1024 * 100
    },
    fileFilter: fileFilter
});

router.post(
    '/',
    upload.single('media'),
    mediaController.saveMediaFile
);

router.get(
    '/auth/file/:id',
    mediaController.getThisAuthFile
);

router.get(
    '/',
    mediaController.getAllAuthFiles
);

module.exports = router;
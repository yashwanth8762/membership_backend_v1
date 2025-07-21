const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const isAuth = require('../../authentication/is-auth');
const mediaTypeController = require('../../Controlers/mediaType');

router.post(
    '/',
    [
        body('name').not().isEmpty()
    ],
    mediaTypeController.saveNewMediaType
);

router.get(
    '/',
    mediaTypeController.getAllMediaTypes
);

module.exports = router;
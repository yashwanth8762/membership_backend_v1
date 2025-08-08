const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const isAuth = require("../../authentication/is-auth");
const talukController = require("../../Controlers/taluk");

router.patch(
  "/status/:id",
  isAuth,
  [body("is_active").trim().not().isEmpty()],
  talukController.updateDistrictStatus
);

router.patch(
  "/archive/:id",
  isAuth,
  talukController.archiveOrActiveDistrict
);


router.patch(
  "/:id",
  isAuth,
  [body("name").trim().not().isEmpty(), body("k_name").trim().not().isEmpty()],
  talukController.updateTaluk
);



router.post(
  "/",
  isAuth,
  [body("name").not().isEmpty()],
  talukController.createTaluk
);

router.get("/active", isAuth, talukController.getAllActiveTalukas);

router.get("/:id", isAuth, talukController.getThisTaluk);

router.get("/", isAuth, talukController.getTalukas);

// Public routes for membership form (no authentication required) - must be at the end
router.get("/public/get-taluk-by-district/:districtId", talukController.getTalukByDistrict);

module.exports = router;
const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const isAuth = require("../../authentication/is-auth");
const districtController = require("../../Controlers/district");

router.patch(
  "/status/:id",
  isAuth,
  [body("is_active").trim().not().isEmpty()],
  districtController.updateDistrictStatus
);

router.patch(
  "/archive/:id",
  isAuth,
  districtController.archiveOrActiveDistrict
);

router.patch(
  "/:id",
  isAuth,
  [body("name").trim().not().isEmpty(), body("k_name").trim().not().isEmpty()],
  districtController.updateDistrict
);

router.post(
  "/",
  isAuth,
  [body("name").not().isEmpty()],
  districtController.createDistrict
);

router.get("/active", isAuth, districtController.getAllActiveDistricts);

router.get("/:id", isAuth, districtController.getThisDistrict);

router.get("/", isAuth, districtController.getDistricts);

// Public routes for membership form (no authentication required) - must be at the end
router.get("/public/active", districtController.getAllActiveDistricts);

module.exports = router;

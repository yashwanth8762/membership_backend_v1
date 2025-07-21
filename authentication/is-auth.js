require("dotenv").config();

const jwt = require("jsonwebtoken");

const STATUS = require("../utils/statusCodes");
const MESSAGE = require("../utils/messages");

const JWT_SECRET = process.env.MEETINGS_PROCEDINGS_JWT_SECRET;

module.exports = async (req, res, next) => {
	const token = req.get('Authorization');

	try {
		if (!token) {
		    return res.status(STATUS.UNAUTHORISED).json({ message: "Please provide the token" });
		} 
		else {
			try {
				let isValid = await jwt.verify(token, JWT_SECRET);
				if (!isValid) {
					return res.status(STATUS.UNAUTHORISED).json({ message: "Your token is not valid" });
				} 
				else {
					let decodedToken = await jwt.decode(token);
					let currentTime = new Date().getTime() / 1000;
					if (currentTime > decodedToken.exp) {
					    return res.status(STATUS.UNAUTHORISED).json({ message: "Your token is expired" });
					} 
                    else {
						req.userId = decodedToken.id;
						next();
					}
				}
			} 
			catch (error) {
				return res.status(STATUS.UNAUTHORISED).json({ message: "Your token is expired" });
			}
		}
	} 
	catch (error) {
		res.status(STATUS.BAD_REQUEST).json({ error: "Internal server error" });
	}
}
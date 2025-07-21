require("dotenv").config();

const STATUS = require("../utils/statusCodes");
const MESSAGE = require("../utils/messages");

const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//     host: process.env.TNO_V1_SMTP_HOST,
//     port: process.env.TNO_V1_SMTP_PORT,
//     auth: {
//         user: process.env.TNO_V1_SMTP_USER,
//         pass: process.env.TNO_V1_SMTP_PASSWORD
//     },
//     tls:{
//         rejectUnauthorized:false
//     }
// });

module.exports.sendForgotPasswordEmail = async (user, password) => {
    try{
        const sentEmail = await transporter.sendMail({
            to: user.email_data.temp_email_id,
            from: process.env.TNO_V1_SMTP_USER,
            subject: 'Temporary Password | TNO.',
            html: forgotEmailContent(user, password),
            envelope: {
                from: process.env.TNO_V1_SMTP_USER,
                to: user.email_data.temp_email_id
            }
        });
        return true
    }
    catch(error) {
        console.log(error);
        return false
    }
}

const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const forgotEmailContent = (user, password) => {
    var html = `
        <div>
            <h3>Hello ${capitalizeFirstLetter(user.first_name)},</h3> </ br></ br>
            <p><b>${password}</b> is your temporary password to login to your account of Taluk Nodal Officers Portal. Do not share this information with anyone else. Kindly change your password once you are successfully logged in to your account.</p> </ br></ br></ br>
            <h4><b>Thanks & Regards,</b></h4> </ br>
            <p>Govt. of Karnataka  ©️</p>
        </div>
    `;

    const htmlData = html;

    return htmlData;
}
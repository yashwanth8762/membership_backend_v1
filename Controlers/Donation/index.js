const Donation = require('../../Modals/Donation');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const {StandardCheckoutClient, Env, StandardCheckoutPayRequest} = require('pg-sdk-node')
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const clientVersion = 1
const env = Env.PRODUCTION
const client = StandardCheckoutClient.getInstance(clientId,clientSecret,clientVersion,env)

exports.submitDonation = async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        mobile,
        address,
        donationAmount,
        message
      } = req.body;
  
      // Basic validation
      if (![firstName, lastName, mobile, address, donationAmount].every(Boolean)) {
        return res.status(400).json({ message: "All required fields must be filled." });
      }
  
      // Create Donation with paymentStatus initiated
      const donation = new Donation({
        firstName,
        lastName,
        mobile,
        address,
        donationAmount,
        message,
        paymentStatus: 'initiated'
      });
      await donation.save();
  
      const merchantOrderId = donation._id.toString();
  
      // Construct redirect URL where your backend will check payment status
      const redirectUrl = `https://www.madaramahasabha.com/api/donation/check-status?merchantOrderId=${merchantOrderId}`;
      // const redirectUrl = `http://localhost:5000/donation/check-status?merchantOrderId=${merchantOrderId}`;

      // Use your production URL accordingly
      // const redirectUrl = `https://yourdomain.com/api/donations/check-status?merchantOrderId=${merchantOrderId}`;
  
      // Convert rupees to paise (multiply by 100)
      const amountInPaise = Math.round(donationAmount * 100);

      // Build your payment request - customize as per your payment client SDK
      const request = StandardCheckoutPayRequest.builder(merchantOrderId)
        .merchantOrderId(merchantOrderId)
        .amount(amountInPaise)
        .redirectUrl(redirectUrl)
        .build();
  
      const paymentResponse = await client.pay(request);
  
      res.status(201).json({
        donationId: merchantOrderId,
        donation,
        checkoutPageUrl: paymentResponse.redirectUrl
      });
    } catch (error) {
      console.error("Error in submitDonation:", error);
      res.status(500).json({ message: "Error submitting donation", error: error.message });
    }
  };

  async function sendSmsViaMsg91(mobileNumber, firstName) {
    const MSG91_AUTHKEY = '462122ASu5sdOuq6889b2bcP1';
    const MSG91_TEMPLATE_ID = process.env.MSG91_DONATION_TEMPLATE_ID; // Flow ID from MSG91
    console.log('name in side the message function',firstName)
    const payload = {
      template_id: MSG91_TEMPLATE_ID,
      short_url: "0",
      realTimeResponse: "1",
      smsroute: "4",
      recipients: [
        {
          mobiles: mobileNumber,
          var: firstName // Must match the variable key in MSG91/DLT template!
        }
      ]
    };
  
    try {
      const response = await axios.post(
        'https://control.msg91.com/api/v5/flow',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            authkey: MSG91_AUTHKEY,
          }
        }
      );
      console.log('MSG91 SMS Template API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending SMS via MSG91 Template API:', error.response?.data || error.message);
      throw error;
    }
  }


  exports.getStatusOfPayment = async (req, res) => {
    console.log('getStatusOfPayment invoked with query:', req.query);
  
    try {
      const { merchantOrderId } = req.query;
      if (!merchantOrderId) {
        return res.status(400).send("MerchantOrderId is required");
      }
  
      const response = await client.getOrderStatus(merchantOrderId);
      const status = response.state;
  
      if (status === 'COMPLETED') {
        const updated = await Donation.findOneAndUpdate(
          { _id: merchantOrderId },
          {
            'paymentResult.status': 'COMPLETED',
            'paymentResult.paymentDate': new Date(),
            'paymentResult.phonepeResponse': response
          },
          { new: true }
        );
  
        if (!updated) {
          return res.status(404).send("Donation submission not found");
        }
  
        // Directly extract mobile and firstName from updated document fields
        const mobileNumber = updated.mobile ? updated.mobile.trim() : '';
        const firstName = updated.firstName ? updated.firstName.trim() : 'Friend';
  
        // console.log('mobileNumber:', mobileNumber, 'firstName:', firstName);
  
        // Normalize mobile number for SMS (no +) and WhatsApp (+)
        let mobileNumberSMS = '';
        let mobileNumberWA = '';
        if (mobileNumber) {
          const digits = mobileNumber.replace(/\D/g, '');
          if (digits.length === 10) {
            mobileNumberSMS = `91${digits}`;
            mobileNumberWA = `+91${digits}`;
          } else if (digits.startsWith('91') && digits.length === 12) {
            mobileNumberSMS = digits;
            mobileNumberWA = `+${digits}`;
          } else if (mobileNumber.startsWith('+91')) {
            mobileNumberSMS = mobileNumber.replace('+', '');
            mobileNumberWA = mobileNumber;
          } else {
            mobileNumberSMS = digits;
            mobileNumberWA = `+${digits}`;
          }
        } else {
          console.log('No valid mobile number found for WhatsApp/SMS message');
        }
        if (mobileNumber) {
          const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '462122ASu5sdOuq6889b2bcP1';
          const name = firstName
  
          // Bulk message payload as per your initial template curl example
          const messagePayload = {
            integrated_number: "15558848753",
            content_type: "template",
            payload: {
              messaging_product: "whatsapp",
              type: "template",
              template: {
                name: "donation",
                language: {
                  code: "en_GB",
                  policy: "deterministic"
                },
                namespace: "33b99d31_01ca_42e2_83fc_59571bba67f6",
                to_and_components: [
                  {
                    to: [mobileNumberWA],
                    components: {
                      body_1: {
                        type: "text",
                        value: name
                      }
                    }
                  }
                ]
              }
            }
          };
  
          const apiURL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
  
          try {
            const axiosResponse = await axios.post(apiURL, messagePayload, {
              headers: {
                'authkey': MSG91_AUTHKEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              maxRedirects: 5
            });
            console.log('WhatsApp API bulk message response:', axiosResponse.data);
          } catch (error) {
            console.error('Failed to send WhatsApp bulk message:', error.response?.data || error.message || error);
          }
        }
        // Example: Send SMS template with firstName variable
        try {
          if (mobileNumberSMS && firstName) {
            await sendSmsViaMsg91(mobileNumberSMS, firstName); // Your existing function
          }
        } catch (smsErr) {
          console.log('MSG91 SMS Template send failed:', smsErr?.response?.data || smsErr.message);
        }
  
        // return res.redirect(`https://www.madaramahasabha.com/payment-success?merchantOrderId=${merchantOrderId}`);
        // return res.redirect(`http://localhost:5000/payment-success`);
        return res.redirect(`https://www.madaramahasabha.com/payment-success`);

  
      } else {
        await Donation.findOneAndUpdate(
          { _id: merchantOrderId },
          {
            'paymentResult.status': 'FAILED',
            'paymentResult.phonepeResponse': response,
          }
        );
        // return res.redirect(`https://www.madaramahasabha.com/payment-failure?merchantOrderId=${merchantOrderId}`);
        // return res.redirect(`http://localhost:5000/payment-failure`);
        return res.redirect(`https://www.madaramahasabha.com/payment-failure`);

      }
    } catch (error) {
      console.error('Error while checking payment status:', error);
      return res.status(500).send('Internal server error during payment status check');
    }
  };
  

const Donation = require('../../Modals/Donation');
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
  
  // Check payment status callback or query
  // exports.getStatusOfPayment = async (req, res) => {
  //   try {
  //     const { merchantOrderId } = req.query;
  //     if (!merchantOrderId) {
  //       return res.status(400).send("merchantOrderId is required");
  //     }
  
  //     // Query payment gateway client for order status
  //     const response = await client.getOrderStatus(merchantOrderId);
  //     const status = response.state; // e.g., 'COMPLETED', 'FAILED', 'PENDING'
  
  //     if (status === 'COMPLETED') {
  //       await Donation.findByIdAndUpdate(merchantOrderId, {
  //         paymentStatus: 'COMPLETED',
  //         paymentDate: new Date(),
  //         paymentGatewayResponse: response
  //       });
  //       // Redirect to your frontend payment success page
  //       return res.redirect(`http://localhost:5173/payment-success`);
  //       // For production:
  //       // return res.redirect(`https://yourdomain.com/payment-success?merchantOrderId=${merchantOrderId}`);
  //     } else {
  //       await Donation.findByIdAndUpdate(merchantOrderId, {
  //         paymentStatus: 'FAILED',
  //         paymentGatewayResponse: response
  //       });
  //       // Redirect to your frontend failure page
  //       return res.redirect(`http://localhost:5173/payment-failure`);
  //       // For production:
  //       // return res.redirect(`https://yourdomain.com/payment-failure?merchantOrderId=${merchantOrderId}`);
  //     }
  //   } catch (error) {
  //     console.error("Error while checking payment status:", error);
  //     res.status(500).send("Internal Server Error");
  //   }
  // };

  exports.getStatusOfPayment = async (req, res) => {
    console.log('getStatusOfPayment invoked with query:', req.query);
  
    try {
      const { merchantOrderId } = req.query;
      if (!merchantOrderId) {
        return res.status(400).send("MerchantOrderId is required");
      }
      const responce = await client.getOrderStatus(merchantOrderId);
      const status = responce.state;
  
      // Update paymentResult.status before redirecting
      if (status === 'COMPLETED') {
        await Donation.findByIdAndUpdate(
          merchantOrderId,
          { 
            'paymentResult.status': 'COMPLETED' // update to capital since your provider returns this
          }
        );
        return res.redirect(`https://www.madaramahasabha.com/payment-success`);
      } else {
        await Order.findByIdAndUpdate(
          merchantOrderId,
          { 
            'paymentResult.status': 'FAILURE'
          }
        );
        return res.redirect(`https://www.madaramahasabha.com/payment-failure`);
      }
  
    } catch (error) {
     console.log('error while Payment', error);
    }
  };

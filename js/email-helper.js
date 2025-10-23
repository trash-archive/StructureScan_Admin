// email-helper.js - EmailJS Integration for 2FA

// EmailJS Configuration
const EMAILJS_SERVICE_ID = "service_p6vxrsi";
const EMAILJS_TEMPLATE_ID = "template_lq3jlxk";
const EMAILJS_PUBLIC_KEY = "dGTH46NE7QB_LtzXs";

// Initialize EmailJS
(function () {
  emailjs.init(EMAILJS_PUBLIC_KEY);
})();

// Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send 2FA verification email
function send2FAEmail(toEmail, toName, code) {
  return new Promise((resolve, reject) => {
    const templateParams = {
      email: toEmail, //
      to_name: toName, //
      code: code, //
    };

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams).then(
      (response) => {
        console.log("✅ Email sent successfully!", response);
        resolve(response);
      },
      (error) => {
        console.error("❌ Failed to send email:", error);
        reject(error);
      }
    );
  });
}

// Store verification code in Firestore
function storeVerificationCode(userId, code) {
  const db = firebase.firestore();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes from now

  return db.collection("verificationCodes").doc(userId).set({
    code: code,
    expiresAt: expiresAt,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Check if 2FA is needed (24 hours passed since last verification)
function needs2FA(userData) {
  if (!userData.last2FAVerification) {
    return true; // Never verified before
  }

  const lastVerification = userData.last2FAVerification.toDate();
  const now = new Date();
  const hoursPassed = (now - lastVerification) / (1000 * 60 * 60);

  return hoursPassed >= 24; // True if 24+ hours passed
}

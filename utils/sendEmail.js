const { transporter } = require('../libs/nodemailer');

module.exports = async (mailOptions) => {
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email: ', error);
        reject(error);
      } else {
        console.log('Email sent: ', info.response);
        resolve(info);
      }
    }); 
  });
};

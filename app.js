const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone'); // Add moment-timezone for timezone handling
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Dummy user credentials for demonstration
const validUsername = process.env.ADMIN_USER;
const validPassword = process.env.ADMIN_PASS;

// /login API implementation
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === validUsername && password === validPassword) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Function to get current date and time in EST
function getESTDate() {
    return moment().tz("America/New_York").format('YYYY-MM-DD');
}

function getESTTime() {
    return moment().tz("America/New_York").format('h:mm:ss A');
}

// Form submission handling
app.post('/submit-form', async (req, res) => {
    const formData = req.body;
    const date = getESTDate();
    const time = getESTTime();

    const submission = {
        sheetType: formData.sheetType,
        time: time,
        tasks: []
    };

    // Extract task questions and responses
    Object.keys(formData).forEach(key => {
        if (key.startsWith('task') && key.endsWith('_question')) {
            const taskIndex = key.match(/task(\d+)_question/)[1];
            const questionKey = `task${taskIndex}_question`; // Assuming the question is passed with this name
            submission.tasks.push({
                question: formData[questionKey], // Correctly set the question from the form data
                notes: formData[`task${taskIndex}_notes`] || ""
            });
        }
    });

    console.log('Submission:', submission);

    try {
        console.log('Sending report...');
        sent = await sendReport(submission, date);
        if (sent) {
            // Redirect to thank you page
            console.log('Report sent successfully!');
            return res.json({ ok: true });
        }
    } catch (error) {
        console.error('Error sending report', error);
    }

    return res.json({ ok: false });
});


// Generate HTML report and send an email
async function sendReport(submission, date) {
    let htmlContent = `<html><body>`;
    htmlContent += `<h4>${submission.sheetType}</h4>`;
    htmlContent += `<p>Time of Submission: ${submission.time}</p>`;
    htmlContent += `<table border="1" cellpadding="5"><tr><th>Task</th><th>Response</th></tr>`;
    submission.tasks.forEach((task) => {
        htmlContent += `<tr><td>${task.question}</td><td>${task.notes}</td></tr>`;
    });
    htmlContent += `</table><br>`;
    htmlContent += `</body></html>`;


    // Define the subject and body using the provided template
    const subject = `${submission.sheetType} Report - ${date}`;
    const body = `
<p>Hi Aman,<p>
<p>Please find the report for ${submission.sheetType} submitted on ${date} below.</p>
${htmlContent}
<br/>

Best regards,<br/>
Bot by Piyush.
        `;

    try {
        // Call the sendEmail function with the prepared data
        const delivered = await sendEmail(subject, body, htmlContent);

        if (delivered) {
            console.log('Report sent successfully!');
            return true;
        }
    } catch (error) {
        console.error('Error sending report:', error);
    }

    return false;
}

// Function to send an email with the provided subject, body, and attachment
async function sendEmail(subject, body) {
    let transporter = nodemailer.createTransport({
        service: 'gmail', // Use your email service provider
        auth: {
            user: process.env.EMAIL_USER, // Your email
            pass: process.env.EMAIL_PASS, // Your email password or app-specific password
        },
    });

    let mailOptions = {
        from: `"Bot by Piyush" <${process.env.EMAIL_USER}>`, // Sender address
        to: "tacoislandlife@gmail.com", // List of receivers
        subject: subject, // Subject line
        html: body,
    };

    try {
        console.log('Sending email...');
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
    }

    return false;
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

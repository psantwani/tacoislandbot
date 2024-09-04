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
    console.log('Form submitted:', JSON.stringify(req.body));
    const formData = req.body;
    const date = getESTDate();
    const time = getESTTime();

    const submission = {
        name: formData.name.trim(),
        sheetType: formData.sheetType,
        time: time,
        tasks: []
    };

    // Extract task questions and responses
    Object.keys(formData).forEach(key => {
        if (key.startsWith('task') && !key.endsWith('_notes') && !key.endsWith('_question')) {
            const taskIndex = key.match(/\d+/)[0];
            const questionKey = `task${taskIndex}_question`; // Assuming the question is passed with this name
            submission.tasks.push({
                question: formData[questionKey], // Correctly set the question from the form data
                answer: formData[key],
                notes: formData[`task${taskIndex}_notes`] || ""
            });
        }
    });

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
    htmlContent += `<h4>Name: ${submission.name} (${submission.sheetType} Sheet)</h4>`;
    htmlContent += `<p>Time of Submission: ${submission.time}</p>`;
    htmlContent += `<table border="1" cellpadding="5"><tr><th>Task</th><th>Answer</th><th>Notes</th></tr>`;
    submission.tasks.forEach((task) => {
        htmlContent += `<tr><td>${task.question}</td><td>${task.answer}</td><td>${task.notes}</td></tr>`;
    });
    htmlContent += `</table><br>`;
    htmlContent += `</body></html>`;


    // Define the subject and body using the provided template
    const subject = `${submission.sheetType} Sheet Report from ${submission.name} - ${date}`;
    const body = `
<p>Hi Aman,<p>
<p>Please find the report for ${submission.sheetType} sheet submitted by ${submission.name} on ${date} below.</p>
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

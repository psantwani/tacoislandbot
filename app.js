const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone'); // Add moment-timezone for timezone handling
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
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
app.post('/submit-form', (req, res) => {
    const formData = req.body;
    const date = getESTDate(); // Get current EST date
    const time = getESTTime(); // Get current EST time
    const filePath = path.join(__dirname, 'submissions', `${date}.json`);

    // Create a structured object with tasks as an array
    const submission = {
        name: formData.name.trim(),
        sheetType: formData.sheetType, // Add sheet type (Opening or Closing)
        time: time, // Add time of submission
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

    // Read existing data or start with an empty array
    let submissions = [];
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        submissions = JSON.parse(data);
    }

    // Check if the user already has an entry and update it, otherwise add a new entry
    const existingIndex = submissions.findIndex(sub => sub.name.toLowerCase() === submission.name.toLowerCase() && sub.sheetType === submission.sheetType);

    if (existingIndex !== -1) {
        // Override the existing entry with the new submission
        submissions[existingIndex] = submission;
    } else {
        // Add the new structured form submission
        submissions.push(submission);
    }

    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(submissions, null, 2));

    // Redirect to thank you page
    res.redirect('/thank-you.html');
});

// Function to delete all files in the 'submissions' directory except for the current date
function deleteOldFiles() {
    const currentDate = getESTDate(); // Get the current date in EST
    const submissionsDir = path.join(__dirname, 'submissions');

    fs.readdir(submissionsDir, (err, files) => {
        if (err) {
            return console.error(`Unable to scan directory: ${err}`);
        }

        files.forEach(file => {
            // Extract the date part from the filename
            const fileDate = file.split('.')[0]; // Assumes filenames are like '2024-09-01.pdf' or '2024-09-01.xlsx'

            // If the file date is not the current date, delete the file
            if (fileDate !== currentDate) {
                const filePath = path.join(submissionsDir, file);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`Error deleting file ${file}: ${err}`);
                    } else {
                        console.log(`Deleted file: ${file}`);
                    }
                });
            }
        });
    });
}

// Cron job to send daily report at midnight EST
cron.schedule('0 23 * * *', () => {
    sendDailyReport();
    deleteOldFiles();
}, {
    timezone: "America/New_York"
});

async function generatePDF(htmlContent, outputPath) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    await page.pdf({ path: outputPath, format: 'A4' });
    await browser.close();
}

// Function to generate HTML report and send email
async function sendDailyReport() {
    const date = getESTDate(); // Get current EST date
    const filePath = path.join(__dirname, 'submissions', `${date}.json`);
    const pdfFilePath = path.join(__dirname, 'submissions', `${date}.pdf`);
    const xlsxFilePath = path.join(__dirname, 'submissions', `${date}.xlsx`);

    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        const submissions = JSON.parse(data);
        const rows = [];

        // Generate HTML content
        let htmlContent = `<html><head><title>Form Submissions for ${date}</title></head><body>`;
        htmlContent += `<h3>Form Submissions for ${date}</h3>`;

        submissions.forEach((submission) => {
            htmlContent += `<h4>Name: ${submission.name} (${submission.sheetType} Sheet)</h4>`;
            htmlContent += `<p>Time of Submission: ${submission.time}</p>`;
            htmlContent += `<table border="1" cellpadding="5"><tr><th>Task</th><th>Answer</th><th>Notes</th></tr>`;
            submission.tasks.forEach((task) => {
                htmlContent += `<tr><td>${task.question}</td><td>${task.answer}</td><td>${task.notes}</td></tr>`;
            });
            htmlContent += `</table><br>`;

            submission.tasks.forEach(task => {
                rows.push({
                    Name: submission.name,
                    SheetType: submission.sheetType,
                    Time: submission.time,
                    Task: task.question,
                    Answer: task.answer,
                    Notes: task.notes
                });
            });

        });

        htmlContent += `</body></html>`;

        await generatePDF(htmlContent, pdfFilePath);

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Report');
        XLSX.writeFile(workbook, xlsxFilePath);

        // Write the HTML content to a file
        // fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');

        // Define the subject and body using the provided template
        const subject = `Daily Operations Report - ${date}`;
        const body = `
Hi Aman,

Please find attached the daily operations report for ${date}. This report includes all form submissions for both the Opening and Closing sheets for the day. Please review the attached document for detailed information on the tasks completed by each team member. Wishing you a productive and successful day ahead.

Best regards,
Bot by Piyush.
        `;

        // Call the sendEmail function with the prepared data
        sendEmail(subject, body, pdfFilePath, `${date}.pdf`, xlsxFilePath, `${date}.xlsx`);
    } else {
        console.log(`No submissions found for ${date}`);
    }
}

// Function to send an email with the provided subject, body, and attachment
function sendEmail(subject, body, pdfPath, pdfName, xlsxPath, xlsxName) {
    attachments = []
    if (fs.existsSync(pdfPath)) {
        attachments.push({
            filename: pdfName,
            path: pdfPath,
            contentType: 'application/pdf'
        });
    }

    if (fs.existsSync(xlsxPath)) {
        attachments.push({
            filename: xlsxName,
            path: xlsxPath,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    }

    let transporter = nodemailer.createTransport({
        service: 'gmail', // Use your email service provider
        auth: {
            user: process.env.EMAIL_USER, // Your email
            pass: process.env.EMAIL_PASS, // Your email password or app-specific password
        },
    });

    let mailOptions = {
        from: `"Bot by Piyush" <${process.env.EMAIL_USER}>`, // Sender address
        to: "psantwani1@gmail.com", // List of receivers
        subject: subject, // Subject line
        text: body, // Plain text body
        attachments: attachments
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.error(`Error sending email: ${error}`);
        }
        console.log(`Email sent successfully: ${info.response}`);
    });
}

sendDailyReport();

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

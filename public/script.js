function loadForm(formId) {
    // Set up form based on cached values from a parent object in localStorage
    const formElement = document.getElementById(formId);
    const formInputs = formElement.querySelectorAll('input[type="text"]');

    // Retrieve the form data object from localStorage
    const formData = JSON.parse(localStorage.getItem(formId)) || {};

    // Set the value for each input from the stored data
    formInputs.forEach(input => {
        const inputName = input.name;
        if (formData[inputName]) {
            input.value = formData[inputName]; // Populate input if data exists
        }
    });
}

function cacheForm(formId) {
    const formElement = document.getElementById(formId);
    const formInputs = formElement.querySelectorAll('input[type="text"]');

    // Retrieve the existing form data object or initialize an empty one
    let formData = JSON.parse(localStorage.getItem(formId)) || {};

    formInputs.forEach(input => {
        const inputName = input.name;

        // If the input has a value in localStorage, set it initially
        if (formData[inputName]) {
            input.value = formData[inputName];
        }

        // Add event listener to update localStorage on input change
        input.addEventListener('input', function () {
            formData[inputName] = input.value; // Update form data object
            localStorage.setItem(formId, JSON.stringify(formData)); // Save updated data
        });
    });
}


function submitForm(formId) {
    const formElement = document.getElementById(formId);
    formElement.addEventListener('submit', function (e) {
        e.preventDefault(); // Prevent the default form submission behavior

        const formData = new FormData(formElement); // Collect form data

        // Convert FormData to JSON object
        const formDataObject = {};
        formData.forEach((value, key) => {
            formDataObject[key] = value;
        });

        fetch('/submit-form', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formDataObject) // Send JSON payload
        })
            .then(response => {
                if (response.ok) {
                    localStorage.removeItem(formId); // Clear form data from localStorage
                    // Redirect to a thank-you page or display a success message
                    window.location.href = '/thank-you.html';
                } else {
                    console.log('Error:', response);
                    alert('There was an error submitting the form. Please report it.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('There was an error submitting the form. Please report it.');
            });
    });
}

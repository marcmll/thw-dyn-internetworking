const validateConditions = (conditions) => {
    let error = false

    // For each condition in the conditions array, perform the validation check
    conditions.forEach((condition) => {
        /* Define variables for the input field, the length of the input and the
        paragraph that will display error messages for that specific field */ 
        const inputField = document.querySelector(condition.query);
        const inputLength = inputField.value.length;
        const errorMsg = document.querySelector(`${condition.query} ~ p`);

        // Reset the error state in case the validation has been performed before
        inputField.classList.remove('error');
        errorMsg.classList.remove('errorMsg');
        errorMsg.innerHTML = '';

        // Validate if the min length has been surpassed and/or if the input length is below the max length
        if (condition.min !== undefined && condition.max !== undefined) {
            if (inputLength < condition.min) {
                /* If the input lenth is below the minimum defined length,
                set error/errorMsg class and set the error message accordingly */
                inputField.classList.add('error');
                errorMsg.classList.add('errorMsg');
                errorMsg.innerHTML = `This input should have at least ${condition.min} characters`;
                error = true;
            }
            if (inputLength > condition.max) {
                if (!inputField.classList.value.includes('error')) {
                    /* If the input length is above the maximum defined length, and an error has yet to be found,
                    set error/errorMsg class and set the error message accordingly */
                    inputField.classList.add('error');
                    errorMsg.classList.add('errorMsg');
                    errorMsg.innerHTML = `This input should have at most ${condition.max} characters`;
                    error = true;
                }
            }
        }

        // Validate the input based on the regex defined in the condition, if that is the case.
        if (condition.regex !== undefined) {
            const regex = RegExp(condition.regex,'gi');
            if (!regex.test(inputField.value)) {
                if (!inputField.classList.value.includes('error')) {
                    /* If the input doesn't pass the regex test, and an error has yet to be found,
                    set error/errorMsg class and set the error message accordingly */
                    inputField.classList.add('error');
                    errorMsg.classList.add('errorMsg');
                    errorMsg.innerHTML = `${condition.errorMsg}`;
                }
                error = true;
            }
        }
    });

    // Return the error state, if no error has been found: return false
    return error
}

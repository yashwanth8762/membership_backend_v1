module.exports.validatePhoneNumber = async (phone_number) => {
    let pattern = /^[6-9]{1}[0-9]{9}$/;
    const check = phone_number.match(pattern);
    if(check){
        return {
            status: true,
            message: 'Success'
        }
    }
    else{
        return {
            status: false,
            message: 'Failed'
        }
    }
}

module.exports.validateEmailID = async (email_id) => {
    let pattern = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    const check = email_id.match(pattern);
    if(check){
        return {
            status: true,
            message: 'Success'
        }
    }
    else{
        return {
            status: false,
            message: 'Failed'
        }
    }
}

module.exports.validatePassword = async (password) => {
    const uppercaseRegExp   = /(?=.*?[A-Z])/;
    const lowercaseRegExp   = /(?=.*?[a-z])/;
    const digitsRegExp      = /(?=.*?[0-9])/;
    const specialCharRegExp = /(?=.*?[#?!@$%^&*-])/;
    const minLengthRegExp   = /.{8,}/;
    const passwordLength =      password.length;
    const uppercasePassword =   uppercaseRegExp.test(password);
    const lowercasePassword =   lowercaseRegExp.test(password);
    const digitsPassword =      digitsRegExp.test(password);
    const specialCharPassword = specialCharRegExp.test(password);
    const minLengthPassword =   minLengthRegExp.test(password);
    let errMsg ="";

    const isMinCharValid = minLengthPassword;
    const isDigitValid = digitsPassword;
    const isSpecialCharValid = specialCharPassword;
    const isUpperCaseValid = uppercasePassword;
    const isLowerCaseValid = lowercasePassword;
    const isEmptyPassword = passwordLength === 0 ? true : false;

    return {
        status: isMinCharValid && isDigitValid && isSpecialCharValid && isUpperCaseValid && isLowerCaseValid === true ? true : false,
        message: 'Failed',
        isMinCharValid,
        isDigitValid,
        isSpecialCharValid,
        isUpperCaseValid,
        isLowerCaseValid,
        isEmptyPassword
    }
}

module.exports.validateName = async (name) => {
    let pattern = /^[^\d]+$/u;
    const check = name.match(pattern);
    if(check){
        return {
            status: true,
            message: 'Success'
        }
    }
    else{
        return {
            status: false,
            message: 'Failed'
        }
    }
}

module.exports.validateFolderName = async (name) => {
    let pattern = /^[a-zA-Z0-9 -]*$/;

    const check = name.match(pattern);
    if(check){
        return {
            status: true,
            message: 'Success'
        }
    }
    else{
        return {
            status: false,
            message: 'Failed'
        }
    }
}

module.exports.validateNumber = async (number=0, min=0, max=0) => {
    let numberInt = parseInt(number);
    return isNaN(numberInt);
}

module.exports.validateRole = async (role) => {

}
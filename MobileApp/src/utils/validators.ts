export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
    // Minimum 8 characters, at least one uppercase, one lowercase, one number, and one special character
    const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+{}[\]|\\:;"'<>,./~`]).{8,}$/;
    return passwordRegex.test(password);
};

export const validateAge = (dateOfBirth: Date): boolean => {
    const today = new Date();
    const ageDiff = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    const dayDiff = today.getDate() - dateOfBirth.getDate();

    if (
        ageDiff > 18 ||
        (ageDiff === 18 && (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)))
    ) {
        return true;
    }

    return false;
};

export const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/-/g, '');

    // Matches +923xx-xxxxxxx or 03xx-xxxxxxx
    const phoneRegex = /^(?:\+92|0)(3(?:1[0-9]|2[0-9]|3[0-9]|4[0-9]|7[0-9]))[0-9]{7}$/;

    return phoneRegex.test(cleaned);
};

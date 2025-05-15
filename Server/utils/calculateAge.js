/**
 * Calculate age from the given date of birth
 * @param {string | Date} dateOfBirth - The date of birth in a string or Date format
 * @returns {number} - The age in the format "X years"
*/

export function calculateAge(dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();
    const hasBirthdayPassedThisYear =
        today.getMonth() > dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

    // Subtract a year if the birthday hasn't occurred yet this year
    if (!hasBirthdayPassedThisYear) {
        age--;
    }

    return age
}


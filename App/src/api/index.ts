import axios from "axios"

export const API_BASE_URL = "http://192.168.100.2:8000/api/"

export const getEmailAvailablity = async () => {
    try {
        const response = await axios.post(`${API_BASE_URL}user/emailAvailiblity`)
        if (response && response.data && response.data.available) {
            return response.data.available;
        }
        return false
    }
    catch (error) {
        console.error("Error validating email avaliblity", error)
    }
}
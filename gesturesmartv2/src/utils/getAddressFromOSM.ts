import { Alert } from "react-native";

export const getAddressFromOSM = async (
    latitude: number,
    longitude: number
): Promise<string> => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
                headers: {
                    "User-Agent": "Gesture Smart/1.0",
                },
            }
        );

        if (!response.ok) {
            throw new Error("Failed to fetch address from OpenStreetMap");
        }

        const data = await response.json();

        if (data && data.address) {
            const addr = data.address;
            const addressParts = [];

            if (addr.house_number) addressParts.push(addr.house_number);
            if (addr.road) addressParts.push(addr.road);
            if (addr.neighbourhood) addressParts.push(addr.neighbourhood);
            if (addr.suburb) addressParts.push(addr.suburb);
            if (addr.city_district) addressParts.push(addr.city_district);
            if (addr.district) addressParts.push(addr.district);
            if (addr.city || addr.town || addr.village) {
                addressParts.push(addr.city || addr.town || addr.village);
            }
            if (addr.state) addressParts.push(addr.state);
            if (addr.postcode) addressParts.push(addr.postcode);
            if (addr.country) addressParts.push(addr.country);

            return addressParts.join(", ");
        } else {
            Alert.alert("Error", "Could not determine address for current location");
            return "Unknown address";
        }
    } catch (error) {
        console.error("OSM Geocoding error:", error);
        Alert.alert("Error", "Failed to get address details");
        return "Unknown address";
    }
};

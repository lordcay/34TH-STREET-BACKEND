/**
 * Location Utilities - Tinder-style Distance Calculation
 * Uses Haversine formula for accurate distance between two coordinates
 */

const EARTH_RADIUS_KM = 6371; // Earth's radius in kilometers

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number} radians
 */
const toRadians = (degrees) => {
    return degrees * (Math.PI / 180);
};

/**
 * Calculate the distance between two geographic points using the Haversine formula
 * This is the same algorithm used by Tinder, Bumble, and other dating apps
 * 
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Return null if any coordinate is invalid
    if (!lat1 || !lon1 || !lat2 || !lon2) {
        return null;
    }

    // Convert to numbers if strings
    lat1 = parseFloat(lat1);
    lon1 = parseFloat(lon1);
    lat2 = parseFloat(lat2);
    lon2 = parseFloat(lon2);

    // Check for valid numbers
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        return null;
    }

    // Return 0 if same location
    if (lat1 === lat2 && lon1 === lon2) {
        return 0;
    }

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = EARTH_RADIUS_KM * c;

    // Round to 1 decimal place
    return Math.round(distance * 10) / 10;
};

/**
 * Format distance for display in a Tinder-like manner
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
const formatDistance = (distanceKm) => {
    if (distanceKm === null || distanceKm === undefined) {
        return null;
    }

    if (distanceKm < 1) {
        // Less than 1km - show "Less than 1 km"
        return 'Less than 1 km away';
    } else if (distanceKm < 10) {
        // Under 10km - show 1 decimal
        return `${distanceKm.toFixed(1)} km away`;
    } else {
        // 10km or more - round to whole number
        return `${Math.round(distanceKm)} km away`;
    }
};

/**
 * Calculate distances for multiple users relative to a reference point
 * @param {Object} referenceUser - User with location.coordinates [lng, lat]
 * @param {Array} users - Array of users to calculate distance to
 * @returns {Array} Users with added 'distance' and 'distanceDisplay' fields
 */
const addDistancesToUsers = (referenceUser, users) => {
    if (!referenceUser?.location?.coordinates || 
        !Array.isArray(referenceUser.location.coordinates) ||
        referenceUser.location.coordinates.length < 2) {
        // Reference user has no location, return users without distances
        return users.map(u => ({ ...u.toJSON ? u.toJSON() : u, distance: null, distanceDisplay: null }));
    }

    const [refLng, refLat] = referenceUser.location.coordinates;

    return users.map(user => {
        const userData = user.toJSON ? user.toJSON() : user;
        
        // Skip if user has disabled location sharing
        if (userData.locationSharingEnabled === false) {
            return { ...userData, distance: null, distanceDisplay: 'Location hidden' };
        }

        // Check if user has valid coordinates
        if (!userData.location?.coordinates || 
            !Array.isArray(userData.location.coordinates) ||
            userData.location.coordinates.length < 2 ||
            (userData.location.coordinates[0] === 0 && userData.location.coordinates[1] === 0)) {
            return { ...userData, distance: null, distanceDisplay: null };
        }

        const [userLng, userLat] = userData.location.coordinates;
        const distance = calculateDistance(refLat, refLng, userLat, userLng);
        
        return {
            ...userData,
            distance,
            distanceDisplay: formatDistance(distance)
        };
    });
};

/**
 * Sort users by distance (nearest first)
 * @param {Array} users - Array of users with distance field
 * @returns {Array} Sorted users (users without distance at end)
 */
const sortByDistance = (users) => {
    return users.sort((a, b) => {
        // Users with no distance go to the end
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
    });
};

/**
 * Filter users within a maximum distance
 * @param {Array} users - Array of users with distance field
 * @param {number} maxDistanceKm - Maximum distance in kilometers
 * @returns {Array} Filtered users
 */
const filterByMaxDistance = (users, maxDistanceKm) => {
    return users.filter(u => {
        // Include users with no distance (they might have location disabled or not set)
        if (u.distance === null || u.distance === undefined) return true;
        return u.distance <= maxDistanceKm;
    });
};

module.exports = {
    calculateDistance,
    formatDistance,
    addDistancesToUsers,
    sortByDistance,
    filterByMaxDistance,
    EARTH_RADIUS_KM
};

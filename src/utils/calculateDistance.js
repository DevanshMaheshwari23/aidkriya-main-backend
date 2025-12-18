// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance; // Returns distance in kilometers
};

// Convert degrees to radians
const toRad = (degrees) => {
  return degrees * (Math.PI / 180);
};

// Calculate total distance from route points
const calculateRouteDistance = (routePoints) => {
  let totalDistance = 0;
  
  for (let i = 1; i < routePoints.length; i++) {
    const prev = routePoints[i - 1];
    const curr = routePoints[i];
    
    const distance = calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );
    
    totalDistance += distance;
  }
  
  return totalDistance;
};

// Find nearby walkers
const findNearbyUsers = (userLocation, allUsers, radiusKm = 5) => {
  return allUsers.filter(user => {
    if (!user.latitude || !user.longitude) return false;
    
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      user.latitude,
      user.longitude
    );
    
    return distance <= radiusKm;
  }).map(user => ({
    ...user,
    distance: calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      user.latitude,
      user.longitude
    )
  })).sort((a, b) => a.distance - b.distance); // Sort by distance
};

module.exports = {
  calculateDistance,
  calculateRouteDistance,
  findNearbyUsers
};

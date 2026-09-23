import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useAuthStore } from '../store/authStore';

export const FacilityContext = createContext(null);

export function FacilityProvider({ children }) {
    const user = useAuthStore((state) => state.user);
    const storeCurrentFacility = useAuthStore((state) => state.currentFacility);
    const setStoreCurrentFacility = useAuthStore((state) => state.setCurrentFacility);

    const [activeFacility, setActiveFacilityState] = useState(() => {
        return localStorage.getItem('polysack_active_facility') || storeCurrentFacility || user?.facilityName || '';
    });

    const [facilities, setFacilities] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch dynamic locations from backend API
    const fetchFacilities = async () => {
        setIsLoading(true);
        try {
            const res = await axiosInstance.get('/locations', { params: { isActive: true } });
            if (res.data?.success && Array.isArray(res.data.data)) {
                setFacilities(res.data.data);
                // If activeFacility is not set yet, default to first available facility or user's assigned facility
                if (!activeFacility && res.data.data.length > 0) {
                    const defaultFac = user?.facilityName || res.data.data[0].name;
                    setActiveFacilityState(defaultFac);
                    localStorage.setItem('polysack_active_facility', defaultFac);
                    if (setStoreCurrentFacility) setStoreCurrentFacility(defaultFac);
                }
            }
        } catch (err) {
            console.warn('Could not fetch facilities:', err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchFacilities();
        }
    }, [user]);

    const setActiveFacility = (facility) => {
        const facilityName = typeof facility === 'object' ? (facility.name || facility.facilityName || '') : facility;
        setActiveFacilityState(facilityName);
        localStorage.setItem('polysack_active_facility', facilityName);
        if (setStoreCurrentFacility) {
            setStoreCurrentFacility(facilityName);
        }
    };

    return (
        <FacilityContext.Provider
            value={{
                activeFacility,
                setActiveFacility,
                facilities,
                setFacilities,
                fetchFacilities,
                isLoading
            }}
        >
            {children}
        </FacilityContext.Provider>
    );
}

export function useFacility() {
    const context = useContext(FacilityContext);
    if (!context) {
        throw new Error('useFacility must be used within a FacilityProvider');
    }
    return context;
}

export default FacilityContext;
